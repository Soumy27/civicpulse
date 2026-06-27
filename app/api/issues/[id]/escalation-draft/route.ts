/**
 * GET /api/issues/[id]/escalation-draft — Groq-drafted formal escalation the
 * reporter can send to a ward officer. Eligible only when > 48h old and still
 * 'reported'.
 */
import { NextResponse } from "next/server";
import { admin, T } from "@/lib/supabase-admin";
import { rowToIssue } from "@/lib/serialize";
import { generateText, isGroqConfigured } from "@/lib/groq";
import { escalationDraftPrompt } from "@/agent/prompts";
import { ageInHours } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const { data } = await admin().from(T.issues).select("*").eq("id", params.id).maybeSingle();
  if (!data) {
    return NextResponse.json({ eligible: false, draftText: "", error: "not_found" }, { status: 404 });
  }
  const issue = rowToIssue(data as Record<string, unknown>);
  const hours = Math.round(ageInHours(issue.createdAt));
  const eligible = hours > 48 && issue.status === "reported";

  if (!eligible) {
    return NextResponse.json({ eligible: false, draftText: "", hoursUntilEligible: Math.max(0, 48 - hours) });
  }

  const reportedDate = new Date(issue.createdAt).toLocaleDateString();
  const fallback =
    `Dear Ward Officer, I am writing about a ${CATEGORY_LABELS[issue.category]} at ${issue.address}, ` +
    `open for ${hours} hours and verified by ${issue.verificationCount} residents. ` +
    `This ${issue.severity}-severity issue needs prompt attention. Kindly arrange an inspection and repair. ` +
    `Issue ID: ${issue.id} | Reported: ${reportedDate}`;

  let draftText = fallback;
  if (isGroqConfigured()) {
    const generated = await generateText(
      escalationDraftPrompt({
        category: CATEGORY_LABELS[issue.category],
        address: issue.address,
        hours,
        verifications: issue.verificationCount,
        severity: issue.severity,
        issueId: issue.id,
        reportedDate,
      }),
      false
    );
    if (generated) draftText = generated.trim();
  }

  return NextResponse.json({ eligible: true, draftText });
}
