/**
 * POST /api/issues — create a civic issue from a classified report.
 *
 * Steps (per spec):
 *  1. Upload photo to Firebase Storage
 *  2. Create the Firestore issue document
 *  3. Increment the ward's totalReported counter
 *  4. Award 10 XP to reporter + recompute badge
 *  5. Recompute + persist the city Civic Score
 *  6. Publish to the Pub/Sub 'new-issues' topic
 *  7. Return { issueId }
 */
import { NextResponse } from "next/server";
import { db, bucket, FieldValue, Timestamp } from "@/lib/firebase-admin";
import { getUidFromRequest } from "@/lib/auth-server";
import { recomputeAndPersistCivicScore } from "@/lib/civicScore";
import { publishNewIssue } from "@/lib/pubsub";
import { inferWardId } from "@/lib/maps";
import { stripDataUrl, mimeFromDataUrl } from "@/lib/gemini";
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
  reporterId?: string; // demo fallback when no auth token
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: CreateIssueBody;
  try {
    body = (await req.json()) as CreateIssueBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Prefer a verified uid; fall back to demo reporterId so the flow works
  // even with anonymous/no auth during a demo.
  const uid = (await getUidFromRequest(req)) ?? body.reporterId ?? "anonymous";

  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const issueId = randomUUID();
  const wardId = body.wardId || inferWardId(lat, lng);
  const category = body.category ?? "other";
  const now = Timestamp.now();

  // ── Step 1: upload photo ───────────────────────────────────
  let photoUrl = "";
  if (body.imageBase64) {
    photoUrl = await uploadPhoto(issueId, body.imageBase64);
  }

  // ── Step 2: create issue document ──────────────────────────
  const needsReview = (body.aiConfidence ?? 0) < 60;
  await db()
    .collection("issues")
    .doc(issueId)
    .set({
      reporterId: uid,
      photoUrl,
      lat,
      lng,
      address: body.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      wardId,
      category,
      severity: body.severity ?? "medium",
      aiDescription: body.aiDescription ?? "",
      aiConfidence: body.aiConfidence ?? 0,
      department: body.department || DEFAULT_DEPARTMENTS[category as IssueCategory],
      extractedEntities: body.extractedEntities ?? [],
      predictedResolutionMinDays: body.predictedResolutionMinDays ?? 0,
      predictedResolutionMaxDays: body.predictedResolutionMaxDays ?? 0,
      status: needsReview ? "needs_review" : "reported",
      isPredicted: false,
      verifierIds: [],
      verificationCount: 0,
      agentReviewCount: 0,
      lastAgentReviewAt: null,
      escalatedAt: null,
      escalationDept: null,
      escalationAttempts: 0,
      mergedIntoIssueId: null,
      createdAt: now,
      updatedAt: now,
    });

  // ── Step 3: ward counter ───────────────────────────────────
  await db()
    .collection("wards")
    .doc(wardId)
    .set(
      {
        wardId,
        wardName: `Indore Ward ${wardId.split("-")[1] ?? ""}`,
        totalReported: FieldValue.increment(1),
        lastUpdated: now,
      },
      { merge: true }
    );

  // ── Step 4: XP + badge ─────────────────────────────────────
  await awardXp(uid, XP_FOR_REPORT, issueId);

  // ── Step 5: civic score ────────────────────────────────────
  await recomputeAndPersistCivicScore().catch((e) => console.error("civicScore recompute:", e));

  // ── Step 6: Pub/Sub ────────────────────────────────────────
  await publishNewIssue(issueId, { category, severity: body.severity, wardId });

  return NextResponse.json({ issueId, status: needsReview ? "needs_review" : "reported" });
}

async function uploadPhoto(issueId: string, imageBase64: string): Promise<string> {
  try {
    const mime = imageBase64.startsWith("data:") ? mimeFromDataUrl(imageBase64) : "image/jpeg";
    const ext = mime.split("/")[1] ?? "jpg";
    const buffer = Buffer.from(stripDataUrl(imageBase64), "base64");
    const file = bucket().file(`issues/${issueId}.${ext}`);
    const token = randomUUID();
    await file.save(buffer, {
      metadata: { contentType: mime, metadata: { firebaseStorageDownloadTokens: token } },
      resumable: false,
    });
    const encoded = encodeURIComponent(file.name);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket().name}/o/${encoded}?alt=media&token=${token}`;
  } catch (err) {
    console.error("photo upload failed:", err);
    return "";
  }
}

async function awardXp(uid: string, amount: number, issueId: string): Promise<void> {
  if (uid === "anonymous") return;
  try {
    const ref = db().collection("users").doc(uid);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prevXp = snap.exists ? Number(snap.data()?.xp ?? 0) : 0;
      const xp = prevXp + amount;
      tx.set(
        ref,
        {
          uid,
          xp,
          badge: badgeForXp(xp),
          reportedIssueIds: FieldValue.arrayUnion(issueId),
        },
        { merge: true }
      );
    });
  } catch (err) {
    console.error("awardXp failed:", err);
  }
}
