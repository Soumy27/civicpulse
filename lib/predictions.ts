/**
 * FEATURE A — Predictive Hotspot Alerts.
 *
 * Looks at resolved issues from the last 90 days, clusters them by category +
 * 500m radius, and where a cluster has 3+ historical resolutions but no
 * current open issue nearby, emits a "predicted" issue and alerts the
 * responsible department BEFORE a citizen reports the next one.
 */
import { db, FieldValue, Timestamp } from "./firebase-admin";
import { serializeIssue } from "./serialize";
import { distanceMeters } from "./utils";
import { sendToDepartment } from "./fcm";
import { inferWardId } from "./maps";
import { DEFAULT_DEPARTMENTS, type Issue, type IssueCategory } from "./types";

const CLUSTER_RADIUS_M = 500;
const WINDOW_DAYS = 90;
const MIN_CLUSTER = 3;

interface Cluster {
  category: IssueCategory;
  members: Issue[];
  centroidLat: number;
  centroidLng: number;
}

export interface PredictionRunResult {
  newPredictions: number;
  alertsSent: number;
  clustersFound: number;
}

export async function runPredictions(now = Date.now()): Promise<PredictionRunResult> {
  const windowStart = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const snap = await db().collection("issues").get();
  const all = snap.docs.map((d) => serializeIssue(d.id, d.data() as Record<string, unknown>));

  const resolved = all.filter(
    (i) => i.status === "resolved" && !i.isPredicted && i.updatedAt >= windowStart
  );
  const openOrPredicted = all.filter(
    (i) => !["resolved", "closed"].includes(i.status) || i.isPredicted
  );

  const clusters = buildClusters(resolved);
  let newPredictions = 0;
  let alertsSent = 0;

  for (const c of clusters) {
    if (c.members.length < MIN_CLUSTER) continue;

    // Skip if there's already an open OR predicted issue of this category
    // near the centroid — no point predicting what's already on the map.
    const alreadyCovered = openOrPredicted.some(
      (i) =>
        i.category === c.category &&
        distanceMeters(c.centroidLat, c.centroidLng, i.lat, i.lng) <= CLUSTER_RADIUS_M
    );
    if (alreadyCovered) continue;

    const department = DEFAULT_DEPARTMENTS[c.category];
    const confidence = Math.min(95, 55 + c.members.length * 8);
    const pattern = `${c.members.length} ${c.category.replace("_", " ")} issues resolved in this zone over the last ${WINDOW_DAYS} days`;

    await db().collection("issues").add({
      reporterId: "agent:predictor",
      photoUrl: "",
      lat: c.centroidLat,
      lng: c.centroidLng,
      address: `Predicted hotspot near ${c.centroidLat.toFixed(4)}, ${c.centroidLng.toFixed(4)}`,
      wardId: inferWardId(c.centroidLat, c.centroidLng),
      category: c.category,
      severity: "medium",
      aiDescription: `AI-predicted recurring ${c.category.replace("_", " ")} hotspot.`,
      aiConfidence: confidence,
      department,
      extractedEntities: [],
      predictedResolutionMinDays: 0,
      predictedResolutionMaxDays: 0,
      status: "predicted",
      isPredicted: true,
      predictedCategory: c.category,
      predictionConfidence: confidence,
      basedOnCount: c.members.length,
      historicalPattern: pattern,
      verifierIds: [],
      verificationCount: 0,
      agentReviewCount: 0,
      lastAgentReviewAt: null,
      escalatedAt: null,
      escalationDept: null,
      escalationAttempts: 0,
      mergedIntoIssueId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    newPredictions++;

    const sent = await sendToDepartment(
      department,
      `🔮 Predictive alert — likely ${c.category.replace("_", " ")}`,
      `${pattern}. Pre-emptive inspection recommended.`,
      { type: "prediction", category: c.category }
    );
    if (sent) alertsSent++;

    // Track ward-level predicted count.
    await db()
      .collection("wards")
      .doc(inferWardId(c.centroidLat, c.centroidLng))
      .set({ totalPredicted: FieldValue.increment(1) }, { merge: true });
  }

  return { newPredictions, alertsSent, clustersFound: clusters.length };
}

/** Greedy single-link clustering by category within CLUSTER_RADIUS_M. */
function buildClusters(issues: Issue[]): Cluster[] {
  const byCategory = new Map<IssueCategory, Issue[]>();
  for (const i of issues) {
    const arr = byCategory.get(i.category) ?? [];
    arr.push(i);
    byCategory.set(i.category, arr);
  }

  const clusters: Cluster[] = [];
  for (const [category, items] of byCategory) {
    const used = new Set<string>();
    for (const seed of items) {
      if (used.has(seed.id)) continue;
      const members = [seed];
      used.add(seed.id);
      for (const other of items) {
        if (used.has(other.id)) continue;
        if (distanceMeters(seed.lat, seed.lng, other.lat, other.lng) <= CLUSTER_RADIUS_M) {
          members.push(other);
          used.add(other.id);
        }
      }
      const centroidLat = members.reduce((s, m) => s + m.lat, 0) / members.length;
      const centroidLng = members.reduce((s, m) => s + m.lng, 0) / members.length;
      clusters.push({ category, members, centroidLat, centroidLng });
    }
  }
  return clusters;
}
