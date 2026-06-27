/**
 * POST /api/issues — create a civic issue from a classified report.
 *  1. Upload photo to Supabase Storage
 *  2. Insert the issue row
 *  3. Bump the ward's reported counter
 *  4. Award 10 XP + recompute badge
 *  5. Recompute + persist the Civic Score
 *  6. Return { issueId }
 */
import { NextResponse } from "next/server";
import { admin, T } from "@/lib/supabase-admin";
import { getUidFromRequest } from "@/lib/auth-server";
import { recomputeAndPersistCivicScore } from "@/lib/civicScore";
import { inferWardId } from "@/lib/maps";
import { stripDataUrl, mimeFromDataUrl } from "@/lib/groq";
import { badgeForXp, XP_FOR_REPORT } from "@/lib/xp";
import { DEFAULT_DEPARTMENTS, type IssueCategory, type Severity } from "@/lib/types";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateIssueBody {
  imageBase64?: string;
  lat: number;
  lng: number;
  address: string;
  wardId?: string;
  category: IssueCategory;
  severity: Severity;
  aiDescription: string;
  aiConfidence: number;
  department?: string;
  extractedEntities?: string[];
  predictedResolutionMinDays?: number;
  predictedResolutionMaxDays?: number;
  reporterId?: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: CreateIssueBody;
  try {
    body = (await req.json()) as CreateIssueBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const uid = (await getUidFromRequest(req)) ?? body.reporterId ?? "anonymous";
  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const db = admin();
  const issueId = randomUUID();
  const wardId = body.wardId || inferWardId(lat, lng);
  const category = body.category ?? "other";
  const now = new Date().toISOString();
  const needsReview = (body.aiConfidence ?? 0) < 60;

  const photoUrl = body.imageBase64 ? await uploadPhoto(issueId, body.imageBase64) : "";

  const { error } = await db.from(T.issues).insert({
    id: issueId,
    reporter_id: uid,
    photo_url: photoUrl,
    lat,
    lng,
    address: body.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    ward_id: wardId,
    category,
    severity: body.severity ?? "medium",
    ai_description: body.aiDescription ?? "",
    ai_confidence: body.aiConfidence ?? 0,
    department: body.department || DEFAULT_DEPARTMENTS[category as IssueCategory],
    extracted_entities: body.extractedEntities ?? [],
    predicted_resolution_min_days: body.predictedResolutionMinDays ?? 0,
    predicted_resolution_max_days: body.predictedResolutionMaxDays ?? 0,
    status: needsReview ? "needs_review" : "reported",
    created_at: now,
    updated_at: now,
  });
  if (error) {
    console.error("issue insert failed:", error);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  // Ward counter (read-modify-write; low contention).
  const { data: ward } = await db.from(T.wards).select("total_reported").eq("ward_id", wardId).maybeSingle();
  await db.from(T.wards).upsert({
    ward_id: wardId,
    ward_name: `Indore Ward ${wardId.split("-")[1] ?? ""}`,
    total_reported: Number(ward?.total_reported ?? 0) + 1,
    last_updated: now,
  });

  await awardXp(uid, XP_FOR_REPORT, issueId);
  await recomputeAndPersistCivicScore().catch((e) => console.error("civicScore:", e));

  return NextResponse.json({ issueId, status: needsReview ? "needs_review" : "reported" });
}

async function uploadPhoto(issueId: string, imageBase64: string): Promise<string> {
  try {
    const mime = imageBase64.startsWith("data:") ? mimeFromDataUrl(imageBase64) : "image/jpeg";
    const ext = mime.split("/")[1] ?? "jpg";
    const buffer = Buffer.from(stripDataUrl(imageBase64), "base64");
    const path = `${issueId}.${ext}`;
    const db = admin();
    const { error } = await db.storage.from("issues").upload(path, buffer, { contentType: mime, upsert: true });
    if (error) {
      console.error("photo upload failed:", error);
      return "";
    }
    return db.storage.from("issues").getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error("photo upload threw:", err);
    return "";
  }
}

async function awardXp(uid: string, amount: number, issueId: string): Promise<void> {
  if (uid === "anonymous") return;
  try {
    const db = admin();
    const { data } = await db.from(T.profiles).select("*").eq("uid", uid).maybeSingle();
    const xp = Number(data?.xp ?? 0) + amount;
    const reported = Array.isArray(data?.reported_issue_ids) ? (data!.reported_issue_ids as string[]) : [];
    if (!reported.includes(issueId)) reported.push(issueId);
    await db.from(T.profiles).upsert({
      uid,
      display_name: data?.display_name ?? "Citizen",
      xp,
      badge: badgeForXp(xp),
      reported_issue_ids: reported,
      verified_issue_ids: data?.verified_issue_ids ?? [],
      ward_id: data?.ward_id ?? "",
    });
  } catch (err) {
    console.error("awardXp failed:", err);
  }
}
