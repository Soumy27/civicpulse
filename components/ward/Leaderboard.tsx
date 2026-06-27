"use client";

import { useLeaderboard } from "@/lib/hooks";
import { BADGE_EMOJI, BADGE_LABELS } from "@/lib/xp";

export function Leaderboard() {
  const { data, loading } = useLeaderboard();

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No citizens ranked yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {data.map((u, i) => (
        <li
          key={u.uid}
          className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-sm font-bold">
            {i + 1}
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">{u.displayName}</div>
            <div className="text-xs text-muted-foreground">
              {BADGE_EMOJI[u.badge]} {BADGE_LABELS[u.badge]}
            </div>
          </div>
          <span className="text-sm font-bold tabular-nums text-primary">{u.xp} XP</span>
        </li>
      ))}
    </ol>
  );
}
