/**
 * The 9 Resolution-Agent tools, implemented as Firestore operations.
 *
 * Design notes:
 *  - Every action tool updates agentMemory (lastAction, actionHistory, a
 *    cooldown window) so the agent is stateful and never repeats an action.
 *  - escalate_issue contains the self-correction contract (FEATURE D):
 *    escalation FAILS when the issue has a prior failed attempt and no
 *    alternativeDept is supplied, forcing the agent to retry with a backup
 *    authority within the same cycle.
 *  - log_decision is the only tool that writes to agentActivity (the live
 *    feed). All tools return JSON-serializable plain objects.
 */
import { db, FieldValue, Timestamp } from "@/lib/firebase-admin";
import { serializeIssue, serializeMemory } from "@/lib/serialize";
import { boundingBox, withinRadius } from "@/lib/maps";
import { ageInHours, distanceMeters } from "@/lib/utils";
import { sendToDepartment, sendToUser } from "@/lib/fcm";
import type { Issue, IssueStatus, Severity, ToolResult } from "@/lib/types";

/** How long an issue is "cooled down" after the agent acts on it. */
export const AGENT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes — re-demo friendly

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const CLOSED_STATUSES: IssueStatus[] = ["resolved", "closed", "predicted"];

// ── Memory helpers ───────────────────────────────────────────
function memoryRef(issueId: string) {
  return db().collection("agentMemory").doc(issueId);
}

async function recordMemory(
  issueId: string,
  action: string,
  opts: { cooldown?: boolean; escalationAttemptDelta?: number } = {}
): Promise<void> {
  const ref = memoryRef(issueId);
  const now = Timestamp.now();
  const update: Record<string, unknown> = {
    issueId,
    lastAction: action,
    lastActionAt: now,
    actionHistory: FieldValue.arrayUnion(`${new Date().toISOString()} — ${action}`),
  };
  if (opts.cooldown) {
    update.cooldownUntil = Timestamp.fromMillis(Date.now() + AGENT_COOLDOWN_MS);
  }
  if (opts.escalationAttemptDelta) {
    update.escalationAttempts = FieldValue.increment(opts.escalationAttemptDelta);
  }
  await ref.set(update, { merge: true });
}

async function bumpAgentReview(issueId: string): Promise<void> {
  await db()
    .collection("issues")
    .doc(issueId)
    .set(
      {
        agentReviewCount: FieldValue.increment(1),
        lastAgentReviewAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
}

async function getIssue(issueId: string): Promise<Issue | null> {
  const snap = await db().collection("issues").doc(issueId).get();
  if (!snap.exists) return null;
  return serializeIssue(snap.id, snap.data() as Record<string, unknown>);
}

// ── TOOL 1: get_open_issues ──────────────────────────────────
export async function get_open_issues(args: {
  minAgeHours: number;
  status?: string;
  wardId?: string;
}): Promise<ToolResult> {
  const minAgeHours = Number(args.minAgeHours ?? 0);
  const snap = await db().collection("issues").get();
  const now = Date.now();

  let issues = snap.docs
    .map((d) => serializeIssue(d.id, d.data() as Record<string, unknown>))
    .filter((i) => {
      if (i.mergedIntoIssueId) return false;
      if (ageInHours(i.createdAt, now) < minAgeHours) return false;
      if (args.wardId && i.wardId !== args.wardId) return false;
      const status = args.status;
      if (!status || status === "all_open") {
        return !CLOSED_STATUSES.includes(i.status);
      }
      return i.status === status;
    });

  issues.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    return a.createdAt - b.createdAt; // older first (greater age)
  });

  // Trim payload to what the model needs to reason; keep it compact.
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
  const snap = await db().collection("issues").get();
  const now = Date.now();

  const candidates = snap.docs
    .map((d) => serializeIssue(d.id, d.data() as Record<string, unknown>))
    .filter(
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
  const snap = await memoryRef(args.issueId).get();
  if (!snap.exists) {
    return {
      lastAction: null,
      lastActionAt: null,
      actionHistory: [],
      cooldownActive: false,
      escalationAttempts: 0,
    };
  }
  const mem = serializeMemory(snap.id, snap.data() as Record<string, unknown>);
  const cooldownActive = (mem.cooldownUntil ?? 0) > Date.now();
  return {
    lastAction: mem.lastAction || null,
    lastActionAt: mem.lastActionAt,
    actionHistory: mem.actionHistory,
    cooldownActive,
    escalationAttempts: mem.escalationAttempts,
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
  const { issueId, department, reason, urgencyLevel, alternativeDept } = args;
  const issue = await getIssue(issueId);
  if (!issue) return { success: false, message: `Issue ${issueId} not found` };

  const priorAttempts = issue.escalationAttempts ?? 0;
  const isRetry = Boolean(alternativeDept);

  // Self-correction contract: a first escalation on an issue that already has
  // a failed attempt (priorAttempts >= 1) FAILS unless an alternativeDept is
  // supplied. This forces the agent to adapt within the same cycle.
  if (priorAttempts >= 1 && !isRetry) {
    await recordMemory(
      issueId,
      `escalation to ${department} FAILED (unreachable / no acknowledgement)`,
      { escalationAttemptDelta: 1 }
    );
    await db()
      .collection("issues")
      .doc(issueId)
      .set(
        { escalationAttempts: FieldValue.increment(1), updatedAt: Timestamp.now() },
        { merge: true }
      );
    return {
      success: false,
      message: `Escalation to ${department} failed — department unreachable / prior escalation unacknowledged. Retry with an alternativeDept (a higher authority).`,
    };
  }

  const targetDept = isRetry ? alternativeDept! : department;
  await db()
    .collection("issues")
    .doc(issueId)
    .set(
      {
        escalatedAt: Timestamp.now(),
        escalationDept: targetDept,
        escalationAttempts: FieldValue.increment(1),
        status: "in_progress",
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

  await sendToDepartment(
    targetDept,
    `🚨 ${urgencyLevel.toUpperCase()} escalation — ${issue.category}`,
    `${reason} (Issue ${issueId} @ ${issue.address})`,
    { issueId, urgencyLevel }
  );

  await recordMemory(
    issueId,
    `escalated (${urgencyLevel}) to ${targetDept}${isRetry ? " [self-correction]" : ""}`,
    { cooldown: true }
  );
  await bumpAgentReview(issueId);

  return {
    success: true,
    message: `Escalated to ${targetDept} at ${urgencyLevel} urgency.${
      isRetry ? " (self-correction succeeded)" : ""
    }`,
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

  // Transfer verifiers (union, no double-count) to the primary.
  const merged = Array.from(new Set([...primary.verifierIds, ...dup.verifierIds]));
  await db()
    .collection("issues")
    .doc(primaryIssueId)
    .set(
      {
        verifierIds: merged,
        verificationCount: merged.length,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

  await db()
    .collection("issues")
    .doc(duplicateIssueId)
    .set(
      {
        mergedIntoIssueId: primaryIssueId,
        status: "closed",
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

  if (dup.reporterId) {
    await sendToUser(
      dup.reporterId,
      "Your report was merged",
      `We linked your ${dup.category} report to an existing one to speed up resolution.`,
      { issueId: primaryIssueId }
    );
  }

  await recordMemory(duplicateIssueId, `merged into ${primaryIssueId}: ${reason}`, {
    cooldown: true,
  });
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
  const { issueId, requestMessage } = args;
  const issue = await getIssue(issueId);
  if (!issue) return { success: false, message: "Issue not found" };

  if (issue.reporterId) {
    await sendToUser(issue.reporterId, "More detail needed on your report", requestMessage, {
      issueId,
    });
  }
  await recordMemory(issueId, `requested evidence: "${requestMessage}"`, { cooldown: true });
  await bumpAgentReview(issueId);

  return { success: true, message: "Evidence request sent to reporter." };
}

// ── TOOL 7: update_status ────────────────────────────────────
export async function update_status(args: {
  issueId: string;
  newStatus: string;
  reason: string;
}): Promise<ToolResult> {
  const { issueId, newStatus, reason } = args;
  const issue = await getIssue(issueId);
  if (!issue) return { success: false, message: "Issue not found" };

  await db()
    .collection("issues")
    .doc(issueId)
    .set({ status: newStatus, updatedAt: Timestamp.now() }, { merge: true });

  await recordMemory(issueId, `status → ${newStatus}: ${reason}`, { cooldown: true });
  await bumpAgentReview(issueId);

  return { success: true, message: `Status updated to ${newStatus}.` };
}

// ── TOOL 8: flag_low_confidence ──────────────────────────────
export async function flag_low_confidence(args: {
  issueId: string;
  confidence: number;
  reason: string;
}): Promise<ToolResult> {
  const { issueId, confidence, reason } = args;
  const issue = await getIssue(issueId);
  if (!issue) return { success: false, message: "Issue not found" };

  await db()
    .collection("issues")
    .doc(issueId)
    .set({ status: "needs_review", updatedAt: Timestamp.now() }, { merge: true });

  await recordMemory(
    issueId,
    `flagged for human review (confidence ${confidence}%): ${reason}`,
    { cooldown: true }
  );
  await bumpAgentReview(issueId);

  return {
    success: true,
    message: `Flagged for human review at ${confidence}% confidence.`,
  };
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
  const { issueId, reasoning, actionTaken, confidenceScore, chainStep } = args;
  const issue = await getIssue(issueId);

  await db().collection("agentActivity").add({
    issueId,
    issueCategory: issue?.category ?? "unknown",
    issueAddress: issue?.address ?? "",
    reasoning,
    actionTaken,
    actionDetail: actionTaken,
    confidenceScore,
    chainStep,
    isSelfCorrection: Boolean(args.isSelfCorrection),
    timestamp: Timestamp.now(),
  });

  return { success: true, logged: true, chainStep };
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

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const fn = TOOL_MAP[name];
  if (!fn) return { success: false, message: `Unknown tool: ${name}` };
  try {
    return await fn(args ?? {});
  } catch (err) {
    console.error(`Tool ${name} failed:`, err);
    return { success: false, message: `Tool ${name} threw: ${(err as Error).message}` };
  }
}
