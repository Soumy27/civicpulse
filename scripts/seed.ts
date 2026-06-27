/**
 * Pre-demo data seeder for Supabase. Run with:  npm run seed
 * Loads 8 spec issues + a resolved pothole cluster (predictions) + recently
 * resolved fillers (healthy Civic Score) + agent_memory for issue-3
 * (self-correction) + wards, profiles, and city_metrics.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {
      /* optional */
    }
  }
}
loadEnv();

import { admin, T } from "../lib/supabase-admin";
import { recomputeAndPersistCivicScore } from "../lib/civicScore";
import { inferWardId } from "../lib/maps";
import { badgeForXp } from "../lib/xp";
import { DEFAULT_DEPARTMENTS, type IssueCategory, type Severity } from "../lib/types";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

interface SeedIssue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  ageMs: number;
  verifications: number;
  status: string;
  lat: number;
  lng: number;
  aiConfidence?: number;
  resolvedAgeMs?: number;
}

const ISSUES: SeedIssue[] = [
  { id: "issue-1", category: "pothole", severity: "high", ageMs: 58 * HOUR, verifications: 4, status: "reported", lat: 22.7196, lng: 75.8577 },
  { id: "issue-2", category: "pothole", severity: "medium", ageMs: 1.5 * HOUR, verifications: 0, status: "reported", lat: 22.7198, lng: 75.858 },
  { id: "issue-3", category: "water_leakage", severity: "high", ageMs: 3 * HOUR, verifications: 1, status: "reported", lat: 22.7215, lng: 75.8612 },
  { id: "issue-4", category: "garbage", severity: "low", ageMs: 12 * DAY, verifications: 0, status: "reported", lat: 22.72, lng: 75.856 },
  { id: "issue-5", category: "broken_streetlight", severity: "medium", ageMs: 36 * HOUR, verifications: 2, status: "reported", lat: 22.718, lng: 75.854 },
  { id: "issue-6", category: "pothole", severity: "high", ageMs: 5 * DAY, verifications: 3, status: "in_progress", lat: 22.7205, lng: 75.8595 },
  { id: "issue-7", category: "garbage", severity: "medium", ageMs: 6 * HOUR, verifications: 0, status: "reported", lat: 22.722, lng: 75.857, aiConfidence: 45 },
  { id: "issue-8", category: "water_leakage", severity: "high", ageMs: 2 * DAY, verifications: 5, status: "resolved", lat: 22.7216, lng: 75.8614, resolvedAgeMs: 2 * DAY },
];

const HISTORY: SeedIssue[] = [
  { id: "hist-1", category: "pothole", severity: "high", ageMs: 40 * DAY, verifications: 6, status: "resolved", lat: 22.7305, lng: 75.865, resolvedAgeMs: 30 * DAY },
  { id: "hist-2", category: "pothole", severity: "medium", ageMs: 55 * DAY, verifications: 4, status: "resolved", lat: 22.7308, lng: 75.8655, resolvedAgeMs: 48 * DAY },
  { id: "hist-3", category: "pothole", severity: "high", ageMs: 70 * DAY, verifications: 7, status: "resolved", lat: 22.7301, lng: 75.8648, resolvedAgeMs: 60 * DAY },
  { id: "hist-4", category: "pothole", severity: "medium", ageMs: 80 * DAY, verifications: 3, status: "resolved", lat: 22.731, lng: 75.8658, resolvedAgeMs: 75 * DAY },
];

const RECENT_RESOLVED: SeedIssue[] = Array.from({ length: 22 }, (_, i) => {
  const cats: IssueCategory[] = ["pothole", "water_leakage", "broken_streetlight", "garbage", "other"];
  const sev: Severity[] = ["low", "medium", "high"];
  const resolvedDays = 2 + (i % 27);
  return {
    id: `resolved-${i + 1}`,
    category: cats[i % cats.length]!,
    severity: sev[i % sev.length]!,
    ageMs: (resolvedDays + 3) * DAY,
    verifications: 3 + (i % 4),
    status: "resolved",
    lat: 22.66 + (i % 6) * 0.012,
    lng: 75.82 + Math.floor(i / 6) * 0.012,
    resolvedAgeMs: resolvedDays * DAY,
  };
});

const DESCRIPTIONS: Record<IssueCategory, string> = {
  pothole: "Large pothole in the carriageway posing a hazard to two-wheelers.",
  water_leakage: "Continuous water leakage from a burst pipeline flooding the road.",
  broken_streetlight: "Streetlight non-functional, leaving the stretch dark at night.",
  garbage: "Uncollected garbage pile overflowing onto the footpath.",
  other: "Civic issue reported by a citizen.",
};

function issueRow(s: SeedIssue, reporterId: string) {
  const created = now - s.ageMs;
  const resolved = s.resolvedAgeMs != null ? now - s.resolvedAgeMs : created;
  return {
    id: s.id,
    reporter_id: reporterId,
    photo_url: `https://picsum.photos/seed/${s.id}/800/600`,
    lat: s.lat,
    lng: s.lng,
    address: `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}, Indore`,
    ward_id: inferWardId(s.lat, s.lng),
    category: s.category,
    severity: s.severity,
    ai_description: DESCRIPTIONS[s.category],
    ai_confidence: s.aiConfidence ?? (s.severity === "high" ? 92 : 78),
    department: DEFAULT_DEPARTMENTS[s.category],
    extracted_entities: ["MG Road", "Indore"],
    predicted_resolution_min_days: 3,
    predicted_resolution_max_days: 6,
    status: s.status,
    is_predicted: false,
    verifier_ids: Array.from({ length: s.verifications }, (_, i) => `verifier-${i + 1}`),
    verification_count: s.verifications,
    escalation_attempts: s.id === "issue-3" ? 1 : 0,
    created_at: iso(created),
    updated_at: iso(s.status === "resolved" ? resolved : created),
  };
}

async function wipe(table: string, col: string, sentinel = "__never__") {
  const { error } = await admin().from(table).delete().neq(col, sentinel);
  if (error) console.error(`wipe ${table}:`, error.message);
}

async function main() {
  console.log("Seeding CivicPulse (Supabase)...");
  const db = admin();

  await wipe(T.activity, "id", "00000000-0000-0000-0000-000000000000");
  await wipe(T.issues, "id");
  await wipe(T.memory, "issue_id");
  await wipe(T.wards, "ward_id");
  await wipe(T.profiles, "uid");
  await wipe(T.metrics, "id");

  console.log("Inserting issues...");
  const rows = [
    ...ISSUES.map((s) => issueRow(s, "demo-user-1")),
    ...HISTORY.map((s) => issueRow(s, "demo-user-2")),
    ...RECENT_RESOLVED.map((s) => issueRow(s, "demo-user-2")),
  ];
  const { error: insErr } = await db.from(T.issues).insert(rows);
  if (insErr) throw new Error("issue insert: " + insErr.message);

  console.log("Seeding agent_memory (issue-3 self-correction)...");
  await db.from(T.memory).insert({
    issue_id: "issue-3",
    last_action: "escalated to Water Supply Board",
    last_action_at: iso(now - 2 * DAY),
    action_history: [`${iso(now - 2 * DAY)} — escalated to Water Supply Board`],
    cooldown_until: iso(now - HOUR),
    escalation_attempts: 1,
  });

  console.log("Seeding wards...");
  const wardAgg = new Map<string, { reported: number; resolved: number }>();
  for (const s of [...ISSUES, ...HISTORY, ...RECENT_RESOLVED]) {
    const w = inferWardId(s.lat, s.lng);
    const a = wardAgg.get(w) ?? { reported: 0, resolved: 0 };
    a.reported++;
    if (s.status === "resolved") a.resolved++;
    wardAgg.set(w, a);
  }
  await db.from(T.wards).insert(
    Array.from(wardAgg).map(([wardId, a]) => ({
      ward_id: wardId,
      ward_name: `Indore Ward ${wardId.split("-")[1]}`,
      total_reported: a.reported,
      total_resolved: a.resolved,
      total_predicted: 0,
      avg_resolution_days: 4.2,
      health_score: Math.round(50 + (a.resolved / Math.max(1, a.reported)) * 50),
      last_updated: iso(now),
    }))
  );

  console.log("Seeding profiles...");
  await db.from(T.profiles).insert([
    { uid: "demo-user-1", display_name: "Aarav Sharma", xp: 85, badge: badgeForXp(85), ward_id: "ward-1", reported_issue_ids: ISSUES.filter((i) => i.status !== "resolved").map((i) => i.id), verified_issue_ids: [] },
    { uid: "demo-user-2", display_name: "Priya Verma", xp: 210, badge: badgeForXp(210), ward_id: "ward-2", reported_issue_ids: HISTORY.map((i) => i.id), verified_issue_ids: [] },
  ]);

  console.log("Seeding city_metrics + recompute...");
  await db.from(T.metrics).insert({
    id: "current",
    civic_score: 74,
    total_open_issues: 7,
    total_resolved_this_month: 23,
    avg_resolution_days: 4.2,
    active_wards_count: wardAgg.size,
    weekly_delta: 3,
    last_updated: iso(now),
  });
  const metrics = await recomputeAndPersistCivicScore(now);
  console.log(`  civicScore recomputed → ${metrics.civicScore}`);

  console.log("\n✅ Seed complete. Open /agent and click 'Run Agent Now'.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
