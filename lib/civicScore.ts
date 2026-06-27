/**
 * FEATURE B — Civic Score. A single 0-100 city-health metric.
 *   resolutionRate 40% | avgResolutionTime 30% | verification 20% | volume 10%
 * Recomputed server-side on every issue mutation; persisted to city_metrics.
 */
import { admin, T } from "./supabase-admin";
import { clamp } from "./utils";
import { scoreColor } from "./score-utils";
import type { CityMetrics } from "./types";

const OPEN_STATUSES = ["reported", "confirmed", "in_progress", "needs_review"];

export interface CivicScoreBreakdown extends CityMetrics {
  resolutionRate: number;
  verificationEngagement: number;
  reportingVolumeScore: number;
  avgResolutionScore: number;
}

export async function computeCivicScore(now = Date.now()): Promise<CivicScoreBreakdown> {
  const { data } = await admin().from(T.issues).select("*");
  const issues = (data ?? []) as Record<string, unknown>[];
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

    const created = new Date(String(raw.created_at)).getTime() || 0;
    const updated = new Date(String(raw.updated_at)).getTime() || created;
    if (Number(raw.verification_count ?? 0) > 0) verifiedCount++;
    if (raw.ward_id) wardIds.add(String(raw.ward_id));

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
  const avgResolutionDays = resolutionDayCount > 0 ? resolutionDaySum / resolutionDayCount : 0;
  const avgResolutionScore = clamp(1 - avgResolutionDays / 14, 0, 1);
  const verificationEngagement =
    totalNonPredicted > 0 ? clamp(verifiedCount / totalNonPredicted, 0, 1) : 0;
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
    weeklyDelta: 0,
    lastUpdated: now,
    resolutionRate,
    verificationEngagement,
    reportingVolumeScore,
    avgResolutionScore,
  };
}

export async function recomputeAndPersistCivicScore(now = Date.now()): Promise<CityMetrics> {
  const db = admin();
  const { data: prev } = await db.from(T.metrics).select("*").eq("id", "current").maybeSingle();
  const prevScore = prev ? Number(prev.civic_score ?? 0) : 0;
  const prevWeekly = prev ? Number(prev.weekly_delta ?? 0) : 0;

  const c = await computeCivicScore(now);
  const weeklyDelta = prev ? c.civicScore - prevScore + prevWeekly : prevWeekly;

  const metrics: CityMetrics = {
    civicScore: c.civicScore,
    totalOpenIssues: c.totalOpenIssues,
    totalResolvedThisMonth: c.totalResolvedThisMonth,
    avgResolutionDays: c.avgResolutionDays,
    activeWardsCount: c.activeWardsCount,
    weeklyDelta,
    lastUpdated: now,
  };

  await db.from(T.metrics).upsert({
    id: "current",
    civic_score: metrics.civicScore,
    total_open_issues: metrics.totalOpenIssues,
    total_resolved_this_month: metrics.totalResolvedThisMonth,
    avg_resolution_days: metrics.avgResolutionDays,
    active_wards_count: metrics.activeWardsCount,
    weekly_delta: metrics.weeklyDelta,
    last_updated: new Date(now).toISOString(),
  });
  return metrics;
}

export { scoreColor };
