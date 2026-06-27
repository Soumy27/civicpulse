/** Pure, client-safe score helpers (no Admin SDK imports). */

export function scoreColor(score: number): "green" | "amber" | "red" {
  if (score > 70) return "green";
  if (score >= 50) return "amber";
  return "red";
}
