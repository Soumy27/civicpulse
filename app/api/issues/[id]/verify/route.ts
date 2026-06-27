/**
 * POST /api/issues/[id]/verify — a citizen corroborates an issue.
 * Guards: can't verify own issue, can't verify twice. 3 verifications → confirmed.
 * Verifier earns 5 XP. Civic score recomputed.
 */
import { NextResponse } from "next/server";
import { admin, T } from "@/lib/supabase-admin";
import { getUidFromRequest } from "@/lib/auth-server";
import { recomputeAndPersistCivicScore } from "@/lib/civicScore";
import { badgeForXp, XP_FOR_VERIFY } from "@/lib/xp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const issueId = params.id;
  let uid = await getUidFromRequest(req);
  if (!uid) {
    try {
      const body = (await req.json()) as { userId?: string };
      uid = body.userId ?? null;
    } catch {
      /* no body */
    }
  }
  if (!uid) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const db = admin();
  const { data: issue } = await db.from(T.issues).select("*").eq("id", issueId).maybeSingle();
  if (!issue) return NextResponse.json({ success: false, error: "Issue not found." }, { status: 404 });

  if (issue.reporter_id === uid) {
    return NextResponse.json({ success: false, error: "You can't verify your own report." }, { status: 400 });
  }
  const verifierIds = Array.isArray(issue.verifier_ids) ? (issue.verifier_ids as string[]) : [];
  if (verifierIds.includes(uid)) {
    return NextResponse.json({ success: false, error: "You've already verified this issue." }, { status: 400 });
  }

  verifierIds.push(uid);
  const newCount = verifierIds.length;
  const newStatus = newCount >= 3 && issue.status === "reported" ? "confirmed" : issue.status;

  await db
    .from(T.issues)
    .update({ verifier_ids: verifierIds, verification_count: newCount, status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", issueId);

  await awardVerifyXp(uid, issueId);
  await recomputeAndPersistCivicScore().catch((e) => console.error(e));

  return NextResponse.json({ success: true, newCount, newStatus });
}

async function awardVerifyXp(uid: string, issueId: string): Promise<void> {
  try {
    const db = admin();
    const { data } = await db.from(T.profiles).select("*").eq("uid", uid).maybeSingle();
    const xp = Number(data?.xp ?? 0) + XP_FOR_VERIFY;
    const verified = Array.isArray(data?.verified_issue_ids) ? (data!.verified_issue_ids as string[]) : [];
    if (!verified.includes(issueId)) verified.push(issueId);
    await db.from(T.profiles).upsert({
      uid,
      display_name: data?.display_name ?? "Citizen",
      xp,
      badge: badgeForXp(xp),
      verified_issue_ids: verified,
      reported_issue_ids: data?.reported_issue_ids ?? [],
      ward_id: data?.ward_id ?? "",
    });
  } catch (err) {
    console.error("awardVerifyXp failed:", err);
  }
}
