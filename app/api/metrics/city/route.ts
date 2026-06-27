/** GET /api/metrics/city — the city_metrics 'current' row for the homepage. */
import { NextResponse } from "next/server";
import { admin, T } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const { data } = await admin().from(T.metrics).select("*").eq("id", "current").maybeSingle();
    if (!data) {
      return NextResponse.json({
        civicScore: 0,
        totalOpenIssues: 0,
        totalResolvedThisMonth: 0,
        avgResolutionDays: 0,
        activeWardsCount: 0,
        weeklyDelta: 0,
        lastUpdated: 0,
      });
    }
    return NextResponse.json({
      civicScore: data.civic_score,
      totalOpenIssues: data.total_open_issues,
      totalResolvedThisMonth: data.total_resolved_this_month,
      avgResolutionDays: data.avg_resolution_days,
      activeWardsCount: data.active_wards_count,
      weeklyDelta: data.weekly_delta,
      lastUpdated: new Date(String(data.last_updated)).getTime(),
    });
  } catch (err) {
    console.error("metrics/city failed:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
