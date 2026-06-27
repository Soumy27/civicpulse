/**
 * Client-safe serializers. Mirror lib/serialize.ts but never import the Admin
 * SDK, so they're safe in the browser bundle. Handles the Firebase Web
 * Timestamp (which exposes toMillis()) and plain numbers.
 */
import type { AgentActivity, Issue } from "./types";

function ms(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toMillis" in v) {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "seconds" in v) {
    return (v as { seconds: number }).seconds * 1000;
  }
  return null;
}

export function serializeIssue(id: string, d: Record<string, unknown>): Issue {
  return {
    id,
    reporterId: String(d.reporterId ?? ""),
    photoUrl: String(d.photoUrl ?? ""),
    lat: Number(d.lat ?? 0),
    lng: Number(d.lng ?? 0),
    address: String(d.address ?? ""),
    wardId: String(d.wardId ?? ""),
    category: (d.category as Issue["category"]) ?? "other",
    severity: (d.severity as Issue["severity"]) ?? "low",
    aiDescription: String(d.aiDescription ?? ""),
    aiConfidence: Number(d.aiConfidence ?? 0),
    department: String(d.department ?? ""),
    extractedEntities: Array.isArray(d.extractedEntities) ? (d.extractedEntities as string[]) : [],
    predictedResolutionMinDays: Number(d.predictedResolutionMinDays ?? 0),
    predictedResolutionMaxDays: Number(d.predictedResolutionMaxDays ?? 0),
    status: (d.status as Issue["status"]) ?? "reported",
    isPredicted: Boolean(d.isPredicted ?? false),
    predictedCategory: d.predictedCategory as Issue["predictedCategory"],
    predictionConfidence:
      d.predictionConfidence != null ? Number(d.predictionConfidence) : undefined,
    basedOnCount: d.basedOnCount != null ? Number(d.basedOnCount) : undefined,
    historicalPattern: d.historicalPattern ? String(d.historicalPattern) : undefined,
    verifierIds: Array.isArray(d.verifierIds) ? (d.verifierIds as string[]) : [],
    verificationCount: Number(d.verificationCount ?? 0),
    agentReviewCount: Number(d.agentReviewCount ?? 0),
    lastAgentReviewAt: ms(d.lastAgentReviewAt),
    escalatedAt: ms(d.escalatedAt),
    escalationDept: d.escalationDept ? String(d.escalationDept) : null,
    escalationAttempts: Number(d.escalationAttempts ?? 0),
    mergedIntoIssueId: d.mergedIntoIssueId ? String(d.mergedIntoIssueId) : null,
    createdAt: ms(d.createdAt) ?? 0,
    updatedAt: ms(d.updatedAt) ?? 0,
  };
}

export function serializeActivity(id: string, d: Record<string, unknown>): AgentActivity {
  return {
    id,
    issueId: String(d.issueId ?? ""),
    issueCategory: String(d.issueCategory ?? ""),
    issueAddress: String(d.issueAddress ?? ""),
    reasoning: String(d.reasoning ?? ""),
    actionTaken: String(d.actionTaken ?? ""),
    actionDetail: String(d.actionDetail ?? ""),
    confidenceScore: Number(d.confidenceScore ?? 0),
    chainStep: Number(d.chainStep ?? 0),
    isSelfCorrection: Boolean(d.isSelfCorrection ?? false),
    timestamp: ms(d.timestamp) ?? 0,
  };
}
