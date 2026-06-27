/**
 * FEATURE A — Predictive Hotspot Alerts. Clusters resolved issues (last 90d) by
 * category within 500m; where a cluster has 3+ resolutions and no current open
 * issue nearby, emit a "predicted" issue so the department is alerted before the
 * next report.
 */
import { admin, T } from "./supabase-admin";
import { rowToIssue } from "./serialize";
import { distanceMeters } from "./utils";
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
  const db = admin();
  const windowStart = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const { data } = await db.from(T.issues).select("*");
  const all = ((data ?? []) as Record<string, unknown>[]).map(rowToIssue);

  const resolved = all.filter(
    (i) => i.status === "resolved" && !i.isPredicted && i.updatedAt >= windowStart
  );
  const openOrPredicted = all.filter(
    (i) => !["resolved", "closed"].includes(i.status) || i.isPredicted
  );

  const clusters = buildClusters(resolved);
  let newPredictions = 0;

  for (const c of clusters) {
    if (c.members.length < MIN_CLUSTER) continue;
    const covered = openOrPredicted.some(
      (i) =>
        i.category === c.category &&
        distanceMeters(c.centroidLat, c.centroidLng, i.lat, i.lng) <= CLUSTER_RADIUS_M
    );
    if (covered) continue;

    const department = DEFAULT_DEPARTMENTS[c.category];
    const confidence = Math.min(95, 55 + c.members.length * 8);
    const pattern = `${c.members.length} ${c.category.replace("_", " ")} issues resolved in this zone over the last ${WINDOW_DAYS} days`;
    const id = `predicted-${c.category}-${Math.round(c.centroidLat * 1e4)}-${Math.round(c.centroidLng * 1e4)}`;

    await db.from(T.issues).upsert({
      id,
      reporter_id: "agent:predictor",
      photo_url: "",
      lat: c.centroidLat,
      lng: c.centroidLng,
      address: `Predicted hotspot near ${c.centroidLat.toFixed(4)}, ${c.centroidLng.toFixed(4)}`,
      ward_id: inferWardId(c.centroidLat, c.centroidLng),
      category: c.category,
      severity: "medium",
      ai_description: `AI-predicted recurring ${c.category.replace("_", " ")} hotspot.`,
      ai_confidence: confidence,
      department,
      status: "predicted",
      is_predicted: true,
      predicted_category: c.category,
      prediction_confidence: confidence,
      based_on_count: c.members.length,
      historical_pattern: pattern,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
    newPredictions++;
  }

  return { newPredictions, alertsSent: 0, clustersFound: clusters.length };
}

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
