/**
 * POST /api/classify — Groq Vision classification + resolution prediction +
 * nearby-duplicate check. Every call degrades gracefully.
 */
import { NextResponse } from "next/server";
import {
  generateFromImage,
  generateText,
  isGroqConfigured,
  mimeFromDataUrl,
  parseJsonFromModel,
} from "@/lib/groq";
import { CLASSIFY_PROMPT, resolutionPredictionPrompt } from "@/agent/prompts";
import { admin, T } from "@/lib/supabase-admin";
import { rowToIssue } from "@/lib/serialize";
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
  entities?: string[];
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
  if (!imageBase64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

  let parsed: RawClassification | null = null;
  if (isGroqConfigured()) {
    const mime = imageBase64.startsWith("data:") ? mimeFromDataUrl(imageBase64) : "image/jpeg";
    const raw = await generateFromImage(CLASSIFY_PROMPT, imageBase64, mime);
    if (raw) parsed = parseJsonFromModel<RawClassification>(raw);
  }

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

  const category: IssueCategory = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "other";
  const severity: Severity = (["low", "medium", "high"] as Severity[]).includes(parsed.severity)
    ? parsed.severity
    : "medium";
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 0))));
  const description = String(parsed.description ?? "").slice(0, 200);
  const department = parsed.department?.trim() || DEFAULT_DEPARTMENTS[category];
  const extractedEntities = Array.isArray(parsed.entities) ? parsed.entities.slice(0, 6) : [];

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

  const [prediction, nearbyIssues] = await Promise.all([
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

async function predictResolution(severity: Severity, category: IssueCategory): Promise<ResolutionPrediction> {
  const fallback: ResolutionPrediction = { minDays: 3, maxDays: 7, confidence: 60 };
  if (!isGroqConfigured()) return fallback;
  const raw = await generateText(resolutionPredictionPrompt(severity, category));
  const parsed = parseJsonFromModel<ResolutionPrediction>(raw);
  if (!parsed) return fallback;
  return {
    minDays: Math.max(1, Math.round(Number(parsed.minDays ?? 3))),
    maxDays: Math.max(2, Math.round(Number(parsed.maxDays ?? 7))),
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 60)))),
  };
}

async function findNearbyDuplicates(lat: number, lng: number, category: IssueCategory) {
  try {
    const box = boundingBox(lat, lng, 300);
    const { data } = await admin()
      .from(T.issues)
      .select("*")
      .eq("category", category)
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat);
    const candidates = ((data ?? []) as Record<string, unknown>[])
      .map(rowToIssue)
      .filter(
        (i) =>
          !i.isPredicted &&
          !i.mergedIntoIssueId &&
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
