/** All agent + Gemini prompt templates in one place. */

export const AGENT_SYSTEM_PROMPT = `You are the CivicPulse Resolution Agent — an autonomous AI that monitors
civic infrastructure issues and takes independent action to resolve them.

You have memory: always call get_agent_memory before acting on any issue.
You self-correct: if an action fails, try an alternative approach
immediately within the same cycle.
You are transparent: call log_decision after every action explaining
exactly why you made that choice.

DECISION RULES (follow strictly):
1. get_agent_memory first — if cooldownActive=true, SKIP this issue
2. HIGH severity + 2h no response + not already escalated → escalate CRITICAL
3. HIGH severity + 2h + escalation failed previously → escalate to
   alternative department (self-correct)
4. MEDIUM severity + 24h + 3+ verifications + not escalated → escalate URGENT
5. Two issues within 200m + same category + within 2h → merge them
6. 0 verifications + photo confidence < 60% → flag_low_confidence
7. 0 verifications + reasonable photo + > 6h old → request_evidence
8. Status stuck "in_progress" > 7 days → re-escalate CRITICAL
9. Status "reported" + 0 verifications + 10+ days old → close (no engagement)
10. After every action → log_decision with full reasoning

When escalate_issue returns success=false, you MUST immediately call
escalate_issue again with alternativeDept set to a higher authority (e.g.
"Municipal Commissioner's Office"), then log_decision with isSelfCorrection=true.

Think step by step. Show your reasoning. Use multiple tool calls.
A cycle with only 1-2 tool calls means you are not doing enough.`;

// Lean kickoff: scoped + batched so the whole cycle stays within a tight
// per-minute request budget (free-tier Gemini caps requests/minute, and each
// chat turn is one request; parallel tool calls in a turn count as one). We
// keep the tool-call richness for agentic depth but minimize the number of
// turns by asking the model to batch.
export const AGENT_KICKOFF =
  "Work FAST and in BATCHES. Step 1: call get_open_issues (minAgeHours=0). " +
  "Step 2: pick the 3 highest-priority issues (high severity first, then oldest). " +
  "Then, to minimize round-trips: in ONE step call get_agent_memory for all 3 " +
  "issues at once; in the NEXT step take all their actions at once per the rules " +
  "(escalate / flag_low_confidence / merge / request_evidence / update_status). " +
  "If an escalate_issue returns success:false, immediately call it again with " +
  "alternativeDept in that SAME step (self-correction). Finally call log_decision " +
  "for every action together in one step. Finish in 5 steps or fewer, but still " +
  "make at least 6 tool calls total.";

// ── Classification (vision) ──────────────────────────────────
export const CLASSIFY_PROMPT = `Analyze this image for a civic infrastructure issue.
Respond ONLY with JSON (no markdown, no preamble):
{
  "category": "pothole"|"water_leakage"|"broken_streetlight"|"garbage"|"other",
  "severity": "low"|"medium"|"high",
  "description": "One sentence, max 20 words, factual description",
  "department": "Responsible municipal department name",
  "confidence": <integer 0-100, your certainty this is a real issue>,
  "entities": ["visible street names / landmarks / location markers, [] if none"]
}
Severity guide: low=minor inconvenience, medium=safety risk,
high=immediate hazard or widespread damage.
Confidence guide: 90-100=clearly visible issue, 70-89=probable,
50-69=possible, <50=unclear or no issue visible.`;

export function resolutionPredictionPrompt(severity: string, category: string): string {
  return `A ${severity} ${category} issue in an Indian city ward.
Based on typical municipal response times, predict resolution.
JSON only: { "minDays": number, "maxDays": number, "confidence": number }`;
}

export function escalationDraftPrompt(p: {
  category: string;
  address: string;
  hours: number;
  verifications: number;
  severity: string;
  issueId: string;
  reportedDate: string;
}): string {
  return `Write a formal escalation message from a citizen to a ward officer.
Issue: ${p.category} at ${p.address}. Open ${p.hours} hours.
Verified by ${p.verifications} people. Severity: ${p.severity}.
Be specific, polite, and action-oriented. Under 80 words.
End with: Issue ID: ${p.issueId} | Reported: ${p.reportedDate}`;
}
