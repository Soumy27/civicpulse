/**
 * FEATURE B — Civic Score. A single 0-100 city-health metric.
 *
 * Formula (weighted average):
 *   resolutionRate          40%  resolved this month / reported this month
 *   avgResolutionTime       30%  normalized, faster = higher
 *   verificationEngagement  20%  verified issues / total issues
 *   reportingVolume         10%  citizen participation, normalized
 *
 * Recomputed server-side on every issue status change. Persisted to
 * cityMetrics/current along with weeklyDelta.
 */
import { db, Timestamp } from "./firebase-admin";
import { clamp } from "./utils";
import { scoreColor } from "./score-utils";
import type { CityMetrics, Issue } from "./types";

function toMillis(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) {
    return (v as Timestamp).toMillis();
  }
  return 0;
}

const OPEN_STATUSES = ["reported", "confirmed", "in_progress", "needs_review"];

export interface CivicScoreBreakdown extends CityMetrics {
  resolutionRate: number;
  verificationEngagement: number;
  reportingVolumeScore: number;
  avgResolutionScore: number;
}

/**
 * Compute the civic score from the current issues collection. Pure read +
 * arithmetic; the caller decides whether to persist the result.
 */
export async function computeCivicScore(now = Date.now()): Promise<CivicScoreBreakdown> {
  const snap = await db().collection("issues").get();
  const issues = snap.docs.map((d) => d.data() as Record<string, unknown>);

  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  let reportedThisMonth = 0;
  let resolvedThisMonth = 0;
  let totalOpen = 0;
  let totalNonPredicted = 0;
  let verifiedCount = 0;
  let resolutionDaySum = 0;
  let resolutionDayCount = 0;
  const wardIds = new Set<string>();

  for (const raw of issues) {
    const status = String(raw.status ?? "reported");
    if (status === "predicted") continue;
    totalNonPredicted++;

    const created = toMillis(raw.createdAt);
    const updated = toMillis(raw.updatedAt) || created;
    const verificationCount = Number(raw.verificationCount ?? 0);
    if (verificationCount > 0) verifiedCount++;
    if (raw.wardId) wardIds.add(String(raw.wardId));

    if (created >= monthAgo) reportedThisMonth++;
    if (status === "resolved") {
      if (updated >= monthAgo) resolvedThisMonth++;
      const days = (updated - created) / (1000 * 60 * 60 * 24);
      if (days > 0) {
        resolutionDaySum += days;
        resolutionDayCount++;
      }
    }
    if (OPEN_STATUSES.includes(status)) totalOpen++;
  }

  const resolutionRate =
    reportedThisMonth > 0 ? clamp(resolvedThisMonth / reportedThisMonth, 0, 1) : 0.5;

  const avgResolutionDays =
    resolutionDayCount > 0 ? resolutionDaySum / resolutionDayCount : 0;
  // Normalize: 0 days = 1.0, 14+ days = 0.0
  const avgResolutionScore = clamp(1 - avgResolutionDays / 14, 0, 1);

  const verificationEngagement =
    totalNonPredicted > 0 ? clamp(verifiedCount / totalNonPredicted, 0, 1) : 0;

  // Reporting volume: normalize against a target of 30 reports/month.
  const reportingVolumeScore = clamp(reportedThisMonth / 30, 0, 1);

  const civicScore = Math.round(
    100 *
      (resolutionRate * 0.4 +
        avgResolutionScore * 0.3 +
        verificationEngagement * 0.2 +
        reportingVolumeScore * 0.1)
  );

  return {
    civicScore: clamp(civicScore, 0, 100),
    totalOpenIssues: totalOpen,
    totalResolvedThisMonth: resolvedThisMonth,
    avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
    activeWardsCount: wardIds.size,
    weeklyDelta: 0, // filled by persist step
    lastUpdated: now,
    resolutionRate,
    verificationEngagement,
    reportingVolumeScore,
    avgResolutionScore,
  };
}

/**
 * Recompute and persist to cityMetrics/current. Computes weeklyDelta by
 * comparing against the previously stored score.
 */
export async function recomputeAndPersistCivicScore(now = Date.now()): Promise<CityMetrics> {
  const ref = db().collection("cityMetrics").doc("current");
  const prevSnap = await ref.get();
  const prevScore = prevSnap.exists ? Number(prevSnap.data()?.civicScore ?? 0) : 0;
  const prevWeekly = prevSnap.exists ? Number(prevSnap.data()?.weeklyDelta ?? 0) : 0;

  const computed = await computeCivicScore(now);
  // Preserve a meaningful weeklyDelta: if we have a previous score, the delta
  // accumulates the change; otherwise keep any seeded value.
  const weeklyDelta = prevSnap.exists ? computed.civicScore - prevScore + prevWeekly : prevWeekly;

  const metrics: CityMetrics = {
    civicScore: computed.civicScore,
    totalOpenIssues: computed.totalOpenIssues,
    totalResolvedThisMonth: computed.totalResolvedThisMonth,
    avgResolutionDays: computed.avgResolutionDays,
    activeWardsCount: computed.activeWardsCount,
    weeklyDelta,
    lastUpdated: now,
  };
  await ref.set(metrics, { merge: true });
  return metrics;
}

export { scoreColor };
