/**
 * Domain types for CivicPulse. Mirrors the Firestore data model.
 *
 * Timestamps are represented as ISO strings on the wire (after serialization)
 * and as numbers (epoch millis) in some compute paths. We keep a flexible
 * `FireTimestamp` alias so client and server agree without importing the
 * Firestore Timestamp type everywhere.
 */

export type IssueCategory =
  | "pothole"
  | "water_leakage"
  | "broken_streetlight"
  | "garbage"
  | "other";

export type Severity = "low" | "medium" | "high";

export type IssueStatus =
  | "reported"
  | "confirmed"
  | "in_progress"
  | "resolved"
  | "closed"
  | "needs_review"
  | "predicted";

export type UrgencyLevel = "normal" | "urgent" | "critical";

export type Badge = "newcomer" | "active_citizen" | "ward_hero" | "civic_champion";

/** Epoch milliseconds. We serialize all Firestore Timestamps to this. */
export type Millis = number;

export interface Issue {
  id: string;
  reporterId: string;
  photoUrl: string;
  lat: number;
  lng: number;
  address: string;
  wardId: string;
  category: IssueCategory;
  severity: Severity;
  aiDescription: string;
  aiConfidence: number; // 0-100
  department: string;
  extractedEntities: string[];
  predictedResolutionMinDays: number;
  predictedResolutionMaxDays: number;
  status: IssueStatus;
  isPredicted: boolean;
  // Prediction-only metadata (FEATURE A)
  predictedCategory?: IssueCategory;
  predictionConfidence?: number;
  basedOnCount?: number;
  historicalPattern?: string;
  verifierIds: string[];
  verificationCount: number;
  agentReviewCount: number;
  lastAgentReviewAt: Millis | null;
  escalatedAt: Millis | null;
  escalationDept: string | null;
  escalationAttempts: number;
  mergedIntoIssueId: string | null;
  createdAt: Millis;
  updatedAt: Millis;
}

export interface AgentActivity {
  id: string;
  issueId: string;
  issueCategory: string;
  issueAddress: string;
  reasoning: string;
  actionTaken: string;
  actionDetail: string;
  confidenceScore: number;
  chainStep: number;
  isSelfCorrection: boolean;
  timestamp: Millis;
}

export interface AgentMemory {
  issueId: string;
  lastAction: string;
  lastActionAt: Millis | null;
  actionHistory: string[];
  cooldownUntil: Millis | null;
  escalationAttempts: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  xp: number;
  badge: Badge;
  wardId: string;
  reportedIssueIds: string[];
  verifiedIssueIds: string[];
  fcmToken: string;
}

export interface Ward {
  wardId: string;
  wardName: string;
  totalReported: number;
  totalResolved: number;
  totalPredicted: number;
  avgResolutionDays: number;
  healthScore: number;
  lastUpdated: Millis;
}

export interface CityMetrics {
  civicScore: number;
  totalOpenIssues: number;
  totalResolvedThisMonth: number;
  avgResolutionDays: number;
  activeWardsCount: number;
  weeklyDelta: number;
  lastUpdated: Millis;
}

// ── Classification API contract ──────────────────────────────
export interface ClassifyResult {
  category: IssueCategory;
  severity: Severity;
  description: string;
  department: string;
  confidence: number;
  extractedEntities: string[];
  predictedResolutionMinDays: number;
  predictedResolutionMaxDays: number;
  nearbyIssues: Issue[];
  needsReview?: boolean;
  reason?: string;
}

export interface ResolutionPrediction {
  minDays: number;
  maxDays: number;
  confidence: number;
}

// ── Agent cycle result ───────────────────────────────────────
export interface AgentCycleResult {
  actionsCount: number;
  issuesProcessed: number;
  selfCorrectionCount: number;
  newPredictions: number;
  summary: string;
}

// ── Tool execution result shapes ─────────────────────────────
export interface ToolResult {
  [key: string]: unknown;
}

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  pothole: "Pothole",
  water_leakage: "Water Leakage",
  broken_streetlight: "Broken Streetlight",
  garbage: "Garbage",
  other: "Other",
};

export const CATEGORY_COLORS: Record<IssueCategory, string> = {
  pothole: "#ef4444", // red
  water_leakage: "#3b82f6", // blue
  broken_streetlight: "#f59e0b", // amber
  garbage: "#22c55e", // green
  other: "#8b5cf6", // violet
};

export const DEFAULT_DEPARTMENTS: Record<IssueCategory, string> = {
  pothole: "Roads & PWD Department",
  water_leakage: "Water Supply Board",
  broken_streetlight: "Electrical & Street Lighting Department",
  garbage: "Solid Waste Management",
  other: "Municipal Commissioner's Office",
};
