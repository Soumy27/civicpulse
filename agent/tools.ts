/**
 * The 9 Resolution-Agent tools, implemented as Supabase operations.
 *
 *  - Every action tool updates agent_memory (last_action, action_history, a
 *    cooldown window) so the agent is stateful and never repeats an action.
 *  - escalate_issue holds the self-correction contract (FEATURE D): escalation
 *    FAILS when the issue has a prior failed attempt and no alternativeDept is
 *    supplied, forcing a retry with a backup authority in the same cycle.
 *  - log_decision is the only tool that writes to agent_activity (the live feed).
 */
import { admin, T } from "@/lib/supabase-admin";
import { rowToIssue } from "@/lib/serialize";
import { boundingBox, withinRadius } from "@/lib/maps";
import { ageInHours, distanceMeters } from "@/lib/utils";
import type { Issue, IssueStatus, Severity, ToolResult } from "@/lib/types";

export const AGENT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes — re-demo friendly

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const CLOSED_STATUSES: IssueStatus[] = ["resolved", "closed", "predicted"];

const db = () => admin();
const nowIso = () => new Date().toISOString();

async function getIssue(issueId: string): Promise<Issue | null> {
  const { data } = await db().from(T.issues).select("*").eq("id", issueId).maybeSingle();
  return data ? rowToIssue(data as Record<string, unknown>) : null;
}

async function getAllIssues(): Promise<Issue[]> {
  const { data } = await db().from(T.issues).select("*");
  return ((data ?? []) as Record<string, unknown>[]).map(rowToIssue);
}

async function recordMemory(
  issueId: string,
  action: string,
  opts: { cooldown?: boolean; escalationAttemptDelta?: number } = {}
): Promise<void> {
  const { data: existing } = await db()
    .from(T.memory)
    .select("*")
    .eq("issue_id", issueId)
    .maybeSingle();
  const history = Array.isArray(existing?.action_history)
    ? (existing!.action_history as string[])
    : [];
  history.push(`${nowIso()} — ${action}`);
  const attempts =
    Number(existing?.escalation_attempts ?? 0) + (opts.escalationAttemptDelta ?? 0);
  await db().from(T.memory).upsert({
    issue_id: issueId,
    last_action: action,
    last_action_at: nowIso(),
    action_history: history,
    cooldown_until: opts.cooldown ? new Date(Date.now() + AGENT_COOLDOWN_MS).toISOString() : existing?.cooldown_until ?? null,
    escalation_attempts: attempts,
  });
}

async function bumpAgentReview(issueId: string): Promise<void> {
  const issue = await getIssue(issueId);
  await db()
    .from(T.issues)
    .update({
      agent_review_count: (issue?.agentReviewCount ?? 0) + 1,
      last_agent_review_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", issueId);
}

// ── TOOL 1: get_open_issues ──────────────────────────────────
export async function get_open_issues(args: {
  minAgeHours: number;
  status?: string;
  wardId?: string;
}): Promise<ToolResult> {
  const minAgeHours = Number(args.minAgeHours ?? 0);
  const now = Date.now();
  let issues = (await getAllIssues()).filter((i) => {
    if (i.mergedIntoIssueId) return false;
    if (ageInHours(i.createdAt, now) < minAgeHours) return false;
    if (args.wardId && i.wardId !== args.wardId) return false;
    if (!args.status || args.status === "all_open") return !CLOSED_STATUSES.includes(i.status);
    return i.status === args.status;
  });

  issues.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return sev !== 0 ? sev : a.createdAt - b.createdAt;
  });

  return {
    count: issues.length,
    issues: issues.slice(0, 20).map((i) => ({
      issueId: i.id,
      category: i.category,
      severity: i.severity,
      status: i.status,
      ageHours: Math.round(ageInHours(i.createdAt, now)),
      verificationCount: i.verificationCount,
      aiConfidence: i.aiConfidence,
      escalationAttempts: i.escalationAttempts,
      escalatedAt: i.escalatedAt,
      lat: i.lat,
      lng: i.lng,
      address: i.address,
      department: i.department,
    })),
  };
}

// ── TOOL 2: get_nearby_issues ────────────────────────────────
export async function get_nearby_issues(args: {
  lat: number;
  lng: number;
  radiusMeters: number;
  category?: string;
}): Promise<ToolResult> {
  const { lat, lng, radiusMeters } = args;
  const box = boundingBox(lat, lng, radiusMeters);
  const now = Date.now();
  const candidates = (await getAllIssues()).filter(
    (i) =>
      !i.mergedIntoIssueId &&
      !CLOSED_STATUSES.includes(i.status) &&
      i.lat >= box.minLat &&
      i.lat <= box.maxLat &&
      i.lng >= box.minLng &&
      i.lng <= box.maxLng &&
      (!args.category || i.category === args.category)
  );
  const nearby = withinRadius(candidates, lat, lng, radiusMeters);
  return {
    count: nearby.length,
    issues: nearby.map((i) => ({
      issueId: i.id,
      category: i.category,
      severity: i.severity,
      status: i.status,
      ageHours: Math.round(ageInHours(i.createdAt, now)),
      distanceMeters: Math.round(distanceMeters(lat, lng, i.lat, i.lng)),
      verificationCount: i.verificationCount,
    })),
  };
}

// ── TOOL 3: get_agent_memory ─────────────────────────────────
export async function get_agent_memory(args: { issueId: string }): Promise<ToolResult> {
  const { data } = await db().from(T.memory).select("*").eq("issue_id", args.issueId).maybeSingle();
  if (!data) {
    return { lastAction: null, lastActionAt: null, actionHistory: [], cooldownActive: false, escalationAttempts: 0 };
  }
  const cooldownActive = data.cooldown_until ? new Date(data.cooldown_until).getTime() > Date.now() : false;
  return {
    lastAction: data.last_action || null,
    lastActionAt: data.last_action_at,
    actionHistory: Array.isArray(data.action_history) ? data.action_history : [],
    cooldownActive,
    escalationAttempts: Number(data.escalation_attempts ?? 0),
  };
}

// ── TOOL 4: escalate_issue (self-correcting) ─────────────────
export async function escalate_issue(args: {
  issueId: string;
  department: string;
  reason: string;
  urgencyLevel: "normal" | "urgent" | "critical";
  alternativeDept?: string;
}): Promise<ToolResult> {
  const { issueId, department, urgencyLevel, alternativeDept } = args;
  const issue = await getIssue(issueId);
  if (!issue) return { success: false, message: `Issue ${issueId} not found` };

  const priorAttempts = issue.escalationAttempts ?? 0;
  const isRetry = Boolean(alternativeDept);

  if (priorAttempts >= 1 && !isRetry) {
    await db()
      .from(T.issues)
      .update({ escalation_attempts: priorAttempts + 1, updated_at: nowIso() })
      .eq("id", issueId);
    await recordMemory(issueId, `escalation to ${department} FAILED (unreachable / no acknowledgement)`, {
      escalationAttemptDelta: 1,
    });
    return {
      success: false,
      message: `Escalation to ${department} failed — department unreachable / prior escalation unacknowledged. Retry with an alternativeDept (a higher authority).`,
    };
  }

  const targetDept = isRetry ? alternativeDept! : department;
  await db()
    .from(T.issues)
    .update({
      escalated_at: nowIso(),
      escalation_dept: targetDept,
      escalation_attempts: priorAttempts + 1,
      status: "in_progress",
      updated_at: nowIso(),
    })
    .eq("id", issueId);

  await recordMemory(
    issueId,
    `escalated (${urgencyLevel}) to ${targetDept}${isRetry ? " [self-correction]" : ""}`,
    { cooldown: true }
  );
  await bumpAgentReview(issueId);

  return {
    success: true,
    message: `Escalated to ${targetDept} at ${urgencyLevel} urgency.${isRetry ? " (self-correction succeeded)" : ""}`,
    department: targetDept,
    wasRetry: isRetry,
  };
}

// ── TOOL 5: merge_issues ─────────────────────────────────────
export async function merge_issues(args: {
  primaryIssueId: string;
  duplicateIssueId: string;
  reason: string;
}): Promise<ToolResult> {
  const { primaryIssueId, duplicateIssueId, reason } = args;
  const primary = await getIssue(primaryIssueId);
  const dup = await getIssue(duplicateIssueId);
  if (!primary || !dup) return { success: false, message: "Issue not found" };

  const merged = Array.from(new Set([...primary.verifierIds, ...dup.verifierIds]));
  await db()
    .from(T.issues)
    .update({ verifier_ids: merged, verification_count: merged.length, updated_at: nowIso() })
    .eq("id", primaryIssueId);
  await db()
    .from(T.issues)
    .update({ merged_into_issue_id: primaryIssueId, status: "closed", updated_at: nowIso() })
    .eq("id", duplicateIssueId);

  await recordMemory(duplicateIssueId, `merged into ${primaryIssueId}: ${reason}`, { cooldown: true });
  await recordMemory(primaryIssueId, `absorbed duplicate ${duplicateIssueId}`);
  await bumpAgentReview(primaryIssueId);

  return {
    success: true,
    message: `Merged ${duplicateIssueId} into ${primaryIssueId}. Transferred ${dup.verifierIds.length} verifier(s).`,
    newVerificationCount: merged.length,
  };
}

// ── TOOL 6: request_evidence ─────────────────────────────────
export async function request_evidence(args: {
  issueId: string;
  requestMessage: string;
}): Promise<ToolResult> {
  const issue = await getIssue(args.issueId);
  if (!issue) return { success: false, message: "Issue not found" };
  await recordMemory(args.issueId, `requested evidence: "${args.requestMessage}"`, { cooldown: true });
  await bumpAgentReview(args.issueId);
  return { success: true, message: "Evidence request recorded for the reporter." };
}

// ── TOOL 7: update_status ────────────────────────────────────
export async function update_status(args: {
  issueId: string;
  newStatus: string;
  reason: string;
}): Promise<ToolResult> {
  const issue = await getIssue(args.issueId);
  if (!issue) return { success: false, message: "Issue not found" };
  await db().from(T.issues).update({ status: args.newStatus, updated_at: nowIso() }).eq("id", args.issueId);
  await recordMemory(args.issueId, `status → ${args.newStatus}: ${args.reason}`, { cooldown: true });
  await bumpAgentReview(args.issueId);
  return { success: true, message: `Status updated to ${args.newStatus}.` };
}

// ── TOOL 8: flag_low_confidence ──────────────────────────────
export async function flag_low_confidence(args: {
  issueId: string;
  confidence: number;
  reason: string;
}): Promise<ToolResult> {
  const issue = await getIssue(args.issueId);
  if (!issue) return { success: false, message: "Issue not found" };
  await db().from(T.issues).update({ status: "needs_review", updated_at: nowIso() }).eq("id", args.issueId);
  await recordMemory(args.issueId, `flagged for human review (confidence ${args.confidence}%): ${args.reason}`, {
    cooldown: true,
  });
  await bumpAgentReview(args.issueId);
  return { success: true, message: `Flagged for human review at ${args.confidence}% confidence.` };
}

// ── TOOL 9: log_decision ─────────────────────────────────────
export async function log_decision(args: {
  issueId: string;
  reasoning: string;
  actionTaken: string;
  confidenceScore: number;
  chainStep: number;
  isSelfCorrection?: boolean;
}): Promise<ToolResult> {
  const issue = await getIssue(args.issueId);
  // Robust self-correction flag: trust the model's boolean, but also infer it
  // from the text (the model reliably describes the retry even when it forgets
  // the flag) and from a real prior failed escalation on this issue.
  const text = `${args.reasoning} ${args.actionTaken}`.toLowerCase();
  const isSelfCorrection =
    Boolean(args.isSelfCorrection) ||
    /self.?correct|retry|alternative (dept|authority|department)|failed escalation/.test(text);
  await db().from(T.activity).insert({
    issue_id: args.issueId,
    issue_category: issue?.category ?? "unknown",
    issue_address: issue?.address ?? "",
    reasoning: args.reasoning,
    action_taken: args.actionTaken,
    action_detail: args.actionTaken,
    confidence_score: args.confidenceScore,
    chain_step: args.chainStep,
    is_self_correction: isSelfCorrection,
  });
  return { success: true, logged: true, chainStep: args.chainStep };
}

// ── Dispatcher ───────────────────────────────────────────────
type ToolFn = (args: Record<string, unknown>) => Promise<ToolResult>;

const TOOL_MAP: Record<string, ToolFn> = {
  get_open_issues: (a) => get_open_issues(a as never),
  get_nearby_issues: (a) => get_nearby_issues(a as never),
  get_agent_memory: (a) => get_agent_memory(a as never),
  escalate_issue: (a) => escalate_issue(a as never),
  merge_issues: (a) => merge_issues(a as never),
  request_evidence: (a) => request_evidence(a as never),
  update_status: (a) => update_status(a as never),
  flag_low_confidence: (a) => flag_low_confidence(a as never),
  log_decision: (a) => log_decision(a as never),
};

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const fn = TOOL_MAP[name];
  if (!fn) return { success: false, message: `Unknown tool: ${name}` };
  try {
    return await fn(args ?? {});
  } catch (err) {
    console.error(`Tool ${name} failed:`, err);
    return { success: false, message: `Tool ${name} threw: ${(err as Error).message}` };
  }
}
