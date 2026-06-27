/**
 * POST /api/issues/[id]/verify — a citizen corroborates an issue.
 *
 * Guards: can't verify your own issue, can't verify twice. At 3 verifications
 * the issue auto-promotes to 'confirmed'. Verifier earns 5 XP. Civic score is
 * recomputed.
 */
import { NextResponse } from "next/server";
import { db, FieldValue, Timestamp } from "@/lib/firebase-admin";
import { getUidFromRequest } from "@/lib/auth-server";
import { recomputeAndPersistCivicScore } from "@/lib/civicScore";
import { badgeForXp, XP_FOR_VERIFY } from "@/lib/xp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const issueId = params.id;
  let uid = await getUidFromRequest(req);
  if (!uid) {
    // Demo fallback: accept a userId in the body.
    try {
      const body = (await req.json()) as { userId?: string };
      uid = body.userId ?? null;
    } catch {
      /* no body */
    }
  }
  if (!uid) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const ref = db().collection("issues").doc(issueId);

  try {
    const outcome = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("not_found");
      const data = snap.data() as Record<string, unknown>;

      if (data.reporterId === uid) throw new Error("own_issue");
      const verifierIds = Array.isArray(data.verifierIds) ? (data.verifierIds as string[]) : [];
      if (verifierIds.includes(uid!)) throw new Error("already_verified");

      const newCount = verifierIds.length + 1;
      const newStatus = newCount >= 3 && data.status === "reported" ? "confirmed" : data.status;

      tx.update(ref, {
        verifierIds: FieldValue.arrayUnion(uid),
        verificationCount: newCount,
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      return { newCount, newStatus: String(newStatus) };
    });

    // Award XP outside the issue transaction.
    await awardVerifyXp(uid, issueId);
    await recomputeAndPersistCivicScore().catch((e) => console.error(e));

    return NextResponse.json({ success: true, ...outcome });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "not_found" ? 404 : 400;
    const message =
      msg === "own_issue"
        ? "You can't verify your own report."
        : msg === "already_verified"
          ? "You've already verified this issue."
          : msg === "not_found"
            ? "Issue not found."
            : "Could not verify.";
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

async function awardVerifyXp(uid: string, issueId: string): Promise<void> {
  try {
    const ref = db().collection("users").doc(uid);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const xp = (snap.exists ? Number(snap.data()?.xp ?? 0) : 0) + XP_FOR_VERIFY;
      tx.set(
        ref,
        { uid, xp, badge: badgeForXp(xp), verifiedIssueIds: FieldValue.arrayUnion(issueId) },
        { merge: true }
      );
    });
  } catch (err) {
    console.error("awardVerifyXp failed:", err);
  }
}
