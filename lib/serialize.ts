/**
 * Map Supabase/Postgres rows (snake_case, ISO timestamps) to the camelCase
 * domain types. Rows are plain JSON, so this module is safe on both server and
 * client (no SDK imports).
 */
import type { AgentActivity, AgentMemory, Issue, UserProfile } from "./types";

type Row = Record<string, unknown>;

/** ISO string / null → epoch millis / null. */
function ms(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const t = new Date(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

export function rowToIssue(d: Row): Issue {
  return {
    id: String(d.id),
    reporterId: String(d.reporter_id ?? ""),
    photoUrl: String(d.photo_url ?? ""),
    lat: Number(d.lat ?? 0),
    lng: Number(d.lng ?? 0),
    address: String(d.address ?? ""),
    wardId: String(d.ward_id ?? ""),
    category: (d.category as Issue["category"]) ?? "other",
    severity: (d.severity as Issue["severity"]) ?? "low",
    aiDescription: String(d.ai_description ?? ""),
    aiConfidence: Number(d.ai_confidence ?? 0),
    department: String(d.department ?? ""),
    extractedEntities: arr(d.extracted_entities),
    predictedResolutionMinDays: Number(d.predicted_resolution_min_days ?? 0),
    predictedResolutionMaxDays: Number(d.predicted_resolution_max_days ?? 0),
    status: (d.status as Issue["status"]) ?? "reported",
    isPredicted: Boolean(d.is_predicted ?? false),
    predictedCategory: (d.predicted_category as Issue["predictedCategory"]) ?? undefined,
    predictionConfidence: d.prediction_confidence != null ? Number(d.prediction_confidence) : undefined,
    basedOnCount: d.based_on_count != null ? Number(d.based_on_count) : undefined,
    historicalPattern: d.historical_pattern ? String(d.historical_pattern) : undefined,
    verifierIds: arr(d.verifier_ids),
    verificationCount: Number(d.verification_count ?? 0),
    agentReviewCount: Number(d.agent_review_count ?? 0),
    lastAgentReviewAt: ms(d.last_agent_review_at),
    escalatedAt: ms(d.escalated_at),
    escalationDept: d.escalation_dept ? String(d.escalation_dept) : null,
    escalationAttempts: Number(d.escalation_attempts ?? 0),
    mergedIntoIssueId: d.merged_into_issue_id ? String(d.merged_into_issue_id) : null,
    createdAt: ms(d.created_at) ?? 0,
    updatedAt: ms(d.updated_at) ?? 0,
  };
}

export function rowToActivity(d: Row): AgentActivity {
  return {
    id: String(d.id),
    issueId: String(d.issue_id ?? ""),
    issueCategory: String(d.issue_category ?? ""),
    issueAddress: String(d.issue_address ?? ""),
    reasoning: String(d.reasoning ?? ""),
    actionTaken: String(d.action_taken ?? ""),
    actionDetail: String(d.action_detail ?? ""),
    confidenceScore: Number(d.confidence_score ?? 0),
    chainStep: Number(d.chain_step ?? 0),
    isSelfCorrection: Boolean(d.is_self_correction ?? false),
    timestamp: ms(d.created_at) ?? 0,
  };
}

export function rowToMemory(d: Row): AgentMemory {
  return {
    issueId: String(d.issue_id),
    lastAction: String(d.last_action ?? ""),
    lastActionAt: ms(d.last_action_at),
    actionHistory: arr(d.action_history),
    cooldownUntil: ms(d.cooldown_until),
    escalationAttempts: Number(d.escalation_attempts ?? 0),
  };
}

export function rowToProfile(d: Row): UserProfile {
  return {
    uid: String(d.uid),
    displayName: String(d.display_name ?? "Citizen"),
    photoURL: String(d.photo_url ?? ""),
    xp: Number(d.xp ?? 0),
    badge: (d.badge as UserProfile["badge"]) ?? "newcomer",
    wardId: String(d.ward_id ?? ""),
    reportedIssueIds: arr(d.reported_issue_ids),
    verifiedIssueIds: arr(d.verified_issue_ids),
    fcmToken: "",
  };
}
