/** POST /api/predictions/run — run the hotspot detection algorithm (FEATURE A). */
import { NextResponse } from "next/server";
import { runPredictions } from "@/lib/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<NextResponse> {
  try {
    const result = await runPredictions();
    return NextResponse.json(result);
  } catch (err) {
    console.error("predictions/run failed:", err);
    return NextResponse.json(
      { newPredictions: 0, alertsSent: 0, clustersFound: 0, error: true },
      { status: 500 }
    );
  }
}
