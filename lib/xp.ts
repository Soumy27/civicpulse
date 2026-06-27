import type { Badge } from "./types";

export const XP_FOR_REPORT = 10;
export const XP_FOR_VERIFY = 5;

/** Badge tiers keyed by minimum XP. */
const BADGE_TIERS: { min: number; badge: Badge }[] = [
  { min: 200, badge: "civic_champion" },
  { min: 100, badge: "ward_hero" },
  { min: 40, badge: "active_citizen" },
  { min: 0, badge: "newcomer" },
];

export function badgeForXp(xp: number): Badge {
  for (const tier of BADGE_TIERS) {
    if (xp >= tier.min) return tier.badge;
  }
  return "newcomer";
}

export const BADGE_LABELS: Record<Badge, string> = {
  newcomer: "Newcomer",
  active_citizen: "Active Citizen",
  ward_hero: "Ward Hero",
  civic_champion: "Civic Champion",
};

export const BADGE_EMOJI: Record<Badge, string> = {
  newcomer: "🌱",
  active_citizen: "⭐",
  ward_hero: "🛡️",
  civic_champion: "🏆",
};
