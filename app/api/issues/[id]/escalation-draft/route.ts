/**
 * GET /api/issues/[id]/escalation-draft — Gemini-drafted formal escalation
 * message the reporter can send to a ward officer. Eligible only when the
 * issue is > 48h old and still 'reported'.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { serializeIssue } from "@/lib/serialize";
import { generateText, isGeminiConfigured } from "@/lib/gemini";
import { escalationDraftPrompt } from "@/agent/prompts";
import { ageInHours } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const snap = await db().collection("issues").doc(params.id).get();
  if (!snap.exists) {
    return NextResponse.json({ eligible: false, draftText: "", error: "not_found" }, { status: 404 });
  }
  const issue = serializeIssue(snap.id, snap.data() as Record<string, unknown>);
  const hours = Math.round(ageInHours(issue.createdAt));
  const eligible = hours > 48 && issue.status === "reported";

  if (!eligible) {
    return NextResponse.json({
      eligible: false,
      draftText: "",
      hoursUntilEligible: Math.max(0, 48 - hours),
    });
  }

  const fallback =
    `Dear Ward Officer, I am writing about a ${CATEGORY_LABELS[issue.category]} at ${issue.address}, ` +
    `open for ${hours} hours and verified by ${issue.verificationCount} residents. ` +
    `This ${issue.severity}-severity issue needs prompt attention. Kindly arrange an inspection and repair. ` +
    `Issue ID: ${issue.id} | Reported: ${new Date(issue.createdAt).toLocaleDateString()}`;

  let draftText = fallback;
  if (isGeminiConfigured()) {
    const generated = await generateText(
      escalationDraftPrompt({
        category: CATEGORY_LABELS[issue.category],
        address: issue.address,
        hours,
        verifications: issue.verificationCount,
        severity: issue.severity,
        issueId: issue.id,
        reportedDate: new Date(issue.createdAt).toLocaleDateString(),
      })
    );
    if (generated) draftText = generated.trim();
  }

  return NextResponse.json({ eligible: true, draftText });
}
