/**
 * Pre-demo data seeder. Run with:  npm run seed
 *
 * Wipes the demo collections and loads:
 *  - 8 spec issues that each trigger a distinct agent action
 *  - a resolved pothole cluster so the predictor produces a hotspot
 *  - agentMemory for Issue 3 (prior failed escalation → self-correction)
 *  - cityMetrics, wards, and two demo users
 *
 * Uses relative imports + a tiny .env loader so it runs under tsx without
 * any path-alias or dotenv setup.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── minimal .env loader (.env.local wins over .env) ──────────
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {
      /* file optional */
    }
  }
}
loadEnv();

import { db, Timestamp } from "../lib/firebase-admin";
import { recomputeAndPersistCivicScore } from "../lib/civicScore";
import { inferWardId } from "../lib/maps";
import { badgeForXp } from "../lib/xp";
import { DEFAULT_DEPARTMENTS, type IssueCategory, type Severity } from "../lib/types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();

function ts(ms: number) {
  return Timestamp.fromMillis(ms);
}

interface SeedIssue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  ageMs: number;
  verifications: number;
  status: string;
  lat: number;
  lng: number;
  aiConfidence?: number;
  resolvedAgeMs?: number; // for resolved issues: how long ago resolved
}

const ISSUES: SeedIssue[] = [
  { id: "issue-1", category: "pothole", severity: "high", ageMs: 58 * HOUR, verifications: 4, status: "reported", lat: 22.7196, lng: 75.8577 },
  { id: "issue-2", category: "pothole", severity: "medium", ageMs: 1.5 * HOUR, verifications: 0, status: "reported", lat: 22.7198, lng: 75.858 },
  { id: "issue-3", category: "water_leakage", severity: "high", ageMs: 3 * HOUR, verifications: 1, status: "reported", lat: 22.7215, lng: 75.8612 },
  { id: "issue-4", category: "garbage", severity: "low", ageMs: 12 * DAY, verifications: 0, status: "reported", lat: 22.72, lng: 75.856 },
  { id: "issue-5", category: "broken_streetlight", severity: "medium", ageMs: 36 * HOUR, verifications: 2, status: "reported", lat: 22.718, lng: 75.854 },
  { id: "issue-6", category: "pothole", severity: "high", ageMs: 5 * DAY, verifications: 3, status: "in_progress", lat: 22.7205, lng: 75.8595 },
  { id: "issue-7", category: "garbage", severity: "medium", ageMs: 6 * HOUR, verifications: 0, status: "reported", lat: 22.722, lng: 75.857, aiConfidence: 45 },
  { id: "issue-8", category: "water_leakage", severity: "high", ageMs: 2 * DAY, verifications: 5, status: "resolved", lat: 22.7216, lng: 75.8614, resolvedAgeMs: 2 * DAY },
];

// Resolved pothole cluster (no open issue nearby) → predictor emits a hotspot.
const HISTORY: SeedIssue[] = [
  { id: "hist-1", category: "pothole", severity: "high", ageMs: 40 * DAY, verifications: 6, status: "resolved", lat: 22.7305, lng: 75.865, resolvedAgeMs: 30 * DAY },
  { id: "hist-2", category: "pothole", severity: "medium", ageMs: 55 * DAY, verifications: 4, status: "resolved", lat: 22.7308, lng: 75.8655, resolvedAgeMs: 48 * DAY },
  { id: "hist-3", category: "pothole", severity: "high", ageMs: 70 * DAY, verifications: 7, status: "resolved", lat: 22.7301, lng: 75.8648, resolvedAgeMs: 60 * DAY },
  { id: "hist-4", category: "pothole", severity: "medium", ageMs: 80 * DAY, verifications: 3, status: "resolved", lat: 22.731, lng: 75.8658, resolvedAgeMs: 75 * DAY },
];

/**
 * Recently-resolved issues (this month) so the Civic Score reflects a healthy
 * city (~74) rather than cratering on a low resolution rate. Spread >1km apart
 * across mixed categories so they never form a 500m prediction cluster, and
 * resolved within the last 28 days so they count toward totalResolvedThisMonth.
 * Backs the spec's `totalResolvedThisMonth: 23`.
 */
const RECENT_RESOLVED: SeedIssue[] = Array.from({ length: 22 }, (_, i) => {
  const cats: IssueCategory[] = ["pothole", "water_leakage", "broken_streetlight", "garbage", "other"];
  const sev: Severity[] = ["low", "medium", "high"];
  const resolvedDays = 2 + (i % 27); // 2..28 days ago
  return {
    id: `resolved-${i + 1}`,
    category: cats[i % cats.length]!,
    severity: sev[i % sev.length]!,
    ageMs: (resolvedDays + 3) * DAY,
    verifications: 3 + (i % 4),
    status: "resolved",
    // Grid spread ~1.3km apart (0.012deg) so no two share a 500m cluster.
    lat: 22.66 + (i % 6) * 0.012,
    lng: 75.82 + Math.floor(i / 6) * 0.012,
    resolvedAgeMs: resolvedDays * DAY,
  };
});

const DESCRIPTIONS: Record<IssueCategory, string> = {
  pothole: "Large pothole in the carriageway posing a hazard to two-wheelers.",
  water_leakage: "Continuous water leakage from a burst pipeline flooding the road.",
  broken_streetlight: "Streetlight non-functional, leaving the stretch dark at night.",
  garbage: "Uncollected garbage pile overflowing onto the footpath.",
  other: "Civic issue reported by a citizen.",
};

async function wipe(collection: string) {
  const snap = await db().collection(collection).get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`  wiped ${snap.size} docs from ${collection}`);
}

async function seedIssue(s: SeedIssue, reporterId: string) {
  const created = now - s.ageMs;
  const resolved = s.resolvedAgeMs != null ? now - s.resolvedAgeMs : created;
  const verifierIds = Array.from({ length: s.verifications }, (_, i) => `verifier-${i + 1}`);
  await db()
    .collection("issues")
    .doc(s.id)
    .set({
      reporterId,
      photoUrl: `https://picsum.photos/seed/${s.id}/800/600`,
      lat: s.lat,
      lng: s.lng,
      address: `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}, Indore`,
      wardId: inferWardId(s.lat, s.lng),
      category: s.category,
      severity: s.severity,
      aiDescription: DESCRIPTIONS[s.category],
      aiConfidence: s.aiConfidence ?? (s.severity === "high" ? 92 : 78),
      department: DEFAULT_DEPARTMENTS[s.category],
      extractedEntities: ["MG Road", "Indore"],
      predictedResolutionMinDays: 3,
      predictedResolutionMaxDays: 6,
      status: s.status,
      isPredicted: false,
      verifierIds,
      verificationCount: s.verifications,
      agentReviewCount: 0,
      lastAgentReviewAt: null,
      escalatedAt: null,
      escalationDept: null,
      escalationAttempts: 0,
      mergedIntoIssueId: null,
      createdAt: ts(created),
      updatedAt: ts(s.status === "resolved" ? resolved : created),
    });
}

async function main() {
  console.log("Seeding CivicPulse demo data...");
  for (const c of ["issues", "agentActivity", "agentMemory", "wards", "departments"]) {
    await wipe(c);
  }

  console.log("Seeding issues...");
  for (const s of ISSUES) await seedIssue(s, "demo-user-1");
  for (const s of HISTORY) await seedIssue(s, "demo-user-2");
  for (const s of RECENT_RESOLVED) await seedIssue(s, "demo-user-2");

  // Issue 3: prior failed escalation → forces self-correction next cycle.
  console.log("Seeding agentMemory (issue-3 self-correction setup)...");
  await db()
    .collection("agentMemory")
    .doc("issue-3")
    .set({
      issueId: "issue-3",
      lastAction: "escalated to Water Supply Board",
      lastActionAt: ts(now - 2 * DAY),
      actionHistory: [`${new Date(now - 2 * DAY).toISOString()} — escalated to Water Supply Board`],
      cooldownUntil: ts(now - HOUR), // expired → not in cooldown
      escalationAttempts: 1,
    });
  // Mirror escalationAttempts onto the issue so the tool sees the prior attempt.
  await db().collection("issues").doc("issue-3").set({ escalationAttempts: 1 }, { merge: true });

  console.log("Seeding department FCM placeholders...");
  for (const dept of Object.values(DEFAULT_DEPARTMENTS).concat(["Municipal Commissioner's Office"])) {
    const slug = dept.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await db().collection("departments").doc(slug).set({ name: dept, fcmToken: "" });
  }

  console.log("Seeding wards...");
  const wardAgg = new Map<string, { reported: number; resolved: number }>();
  for (const s of [...ISSUES, ...HISTORY, ...RECENT_RESOLVED]) {
    const w = inferWardId(s.lat, s.lng);
    const agg = wardAgg.get(w) ?? { reported: 0, resolved: 0 };
    agg.reported++;
    if (s.status === "resolved") agg.resolved++;
    wardAgg.set(w, agg);
  }
  for (const [wardId, agg] of wardAgg) {
    const healthScore = Math.round(50 + (agg.resolved / Math.max(1, agg.reported)) * 50);
    await db()
      .collection("wards")
      .doc(wardId)
      .set({
        wardId,
        wardName: `Indore Ward ${wardId.split("-")[1]}`,
        totalReported: agg.reported,
        totalResolved: agg.resolved,
        totalPredicted: 0,
        avgResolutionDays: 4.2,
        healthScore,
        lastUpdated: ts(now),
      });
  }

  console.log("Seeding users...");
  await db().collection("users").doc("demo-user-1").set({
    uid: "demo-user-1",
    displayName: "Aarav Sharma",
    photoURL: "",
    xp: 85,
    badge: badgeForXp(85),
    wardId: "ward-1",
    reportedIssueIds: ISSUES.filter((i) => i.status !== "resolved").map((i) => i.id),
    verifiedIssueIds: [],
    fcmToken: "",
  });
  await db().collection("users").doc("demo-user-2").set({
    uid: "demo-user-2",
    displayName: "Priya Verma",
    photoURL: "",
    xp: 210,
    badge: badgeForXp(210),
    wardId: "ward-2",
    reportedIssueIds: HISTORY.map((i) => i.id),
    verifiedIssueIds: [],
    fcmToken: "",
  });

  console.log("Seeding cityMetrics (baseline 74) ...");
  await db().collection("cityMetrics").doc("current").set({
    civicScore: 74,
    totalOpenIssues: 7,
    totalResolvedThisMonth: 23,
    avgResolutionDays: 4.2,
    activeWardsCount: wardAgg.size,
    weeklyDelta: 3,
    lastUpdated: ts(now),
  });
  // Recompute so the persisted score reflects the seeded issues exactly.
  const metrics = await recomputeAndPersistCivicScore(now);
  console.log(`  civicScore recomputed → ${metrics.civicScore}`);

  console.log("\n✅ Seed complete. Open /agent and click 'Run Agent Now'.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
