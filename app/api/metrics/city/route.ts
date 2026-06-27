/** GET /api/metrics/city — the cityMetrics/current document for the homepage. */
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const snap = await db().collection("cityMetrics").doc("current").get();
    if (!snap.exists) {
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
    return NextResponse.json(snap.data());
  } catch (err) {
    console.error("metrics/city failed:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
