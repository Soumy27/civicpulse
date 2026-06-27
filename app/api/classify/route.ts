/**
 * POST /api/classify — Gemini Vision classification + NL entities + resolution
 * prediction + nearby-duplicate check.
 *
 * Every external call is wrapped so a single failure degrades gracefully
 * instead of returning an error screen (UX requirement).
 */
import { NextResponse } from "next/server";
import {
  generateFromImage,
  generateText,
  isGeminiConfigured,
  mimeFromDataUrl,
  parseJsonFromModel,
} from "@/lib/gemini";
import { CLASSIFY_PROMPT, resolutionPredictionPrompt } from "@/agent/prompts";
import { extractEntities } from "@/lib/natural-language";
import { db } from "@/lib/firebase-admin";
import { serializeIssue } from "@/lib/serialize";
import { boundingBox, withinRadius } from "@/lib/maps";
import {
  DEFAULT_DEPARTMENTS,
  type ClassifyResult,
  type IssueCategory,
  type ResolutionPrediction,
  type Severity,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClassifyBody {
  imageBase64: string;
  lat: number;
  lng: number;
  wardId: string;
}

interface RawClassification {
  category: IssueCategory;
  severity: Severity;
  description: string;
  department: string;
  confidence: number;
}

const VALID_CATEGORIES: IssueCategory[] = [
  "pothole",
  "water_leakage",
  "broken_streetlight",
  "garbage",
  "other",
];

export async function POST(req: Request): Promise<NextResponse> {
  let body: ClassifyBody;
  try {
    body = (await req.json()) as ClassifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageBase64, lat, lng } = body;
  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
  }

  // ── Step 1: Gemini Vision classification ───────────────────
  let parsed: RawClassification | null = null;
  if (isGeminiConfigured()) {
    const mime = imageBase64.startsWith("data:") ? mimeFromDataUrl(imageBase64) : "image/jpeg";
    const raw = await generateFromImage(CLASSIFY_PROMPT, imageBase64, mime);
    if (raw) parsed = parseJsonFromModel<RawClassification>(raw);
  }

  // Graceful fallback when Gemini is unavailable or returns junk.
  if (!parsed) {
    const fallback: ClassifyResult = {
      category: "other",
      severity: "medium",
      description: "Could not analyze automatically — please add a description.",
      department: DEFAULT_DEPARTMENTS.other,
      confidence: 50,
      extractedEntities: [],
      predictedResolutionMinDays: 3,
      predictedResolutionMaxDays: 7,
      nearbyIssues: [],
      needsReview: true,
      reason: "AI analysis unavailable",
    };
    return NextResponse.json(fallback);
  }

  // Normalize model output defensively.
  const category: IssueCategory = VALID_CATEGORIES.includes(parsed.category)
    ? parsed.category
    : "other";
  const severity: Severity = (["low", "medium", "high"] as Severity[]).includes(parsed.severity)
    ? parsed.severity
    : "medium";
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 0))));
  const description = String(parsed.description ?? "").slice(0, 200);
  const department = parsed.department?.trim() || DEFAULT_DEPARTMENTS[category];

  // ── Step 2: low-confidence short-circuit ───────────────────
  if (confidence < 60) {
    const result: ClassifyResult = {
      category,
      severity,
      description,
      department,
      confidence,
      extractedEntities: [],
      predictedResolutionMinDays: 0,
      predictedResolutionMaxDays: 0,
      nearbyIssues: [],
      needsReview: true,
      reason: "Image unclear — will be reviewed manually.",
    };
    return NextResponse.json(result);
  }

  // ── Steps 3-5 run concurrently (entities, prediction, dups) ─
  const [extractedEntities, prediction, nearbyIssues] = await Promise.all([
    extractEntities(description),
    predictResolution(severity, category),
    findNearbyDuplicates(lat, lng, category),
  ]);

  const result: ClassifyResult = {
    category,
    severity,
    description,
    department,
    confidence,
    extractedEntities,
    predictedResolutionMinDays: prediction.minDays,
    predictedResolutionMaxDays: prediction.maxDays,
    nearbyIssues,
  };
  return NextResponse.json(result);
}

async function predictResolution(
  severity: Severity,
  category: IssueCategory
): Promise<ResolutionPrediction> {
  const fallback: ResolutionPrediction = { minDays: 3, maxDays: 7, confidence: 60 };
  if (!isGeminiConfigured()) return fallback;
  const raw = await generateText(resolutionPredictionPrompt(severity, category));
  if (!raw) return fallback;
  const parsed = parseJsonFromModel<ResolutionPrediction>(raw);
  if (!parsed) return fallback;
  return {
    minDays: Math.max(1, Math.round(Number(parsed.minDays ?? 3))),
    maxDays: Math.max(2, Math.round(Number(parsed.maxDays ?? 7))),
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 60)))),
  };
}

/** Firestore bounding-box + haversine refine within 300m, same category. */
async function findNearbyDuplicates(lat: number, lng: number, category: IssueCategory) {
  try {
    const box = boundingBox(lat, lng, 300);
    const snap = await db()
      .collection("issues")
      .where("lat", ">=", box.minLat)
      .where("lat", "<=", box.maxLat)
      .get();
    const candidates = snap.docs
      .map((d) => serializeIssue(d.id, d.data() as Record<string, unknown>))
      .filter(
        (i) =>
          !i.isPredicted &&
          !i.mergedIntoIssueId &&
          i.category === category &&
          i.lng >= box.minLng &&
          i.lng <= box.maxLng &&
          ["reported", "confirmed", "in_progress"].includes(i.status)
      );
    return withinRadius(candidates, lat, lng, 300).slice(0, 3);
  } catch (err) {
    console.error("nearby duplicate check failed:", err);
    return [];
  }
}
