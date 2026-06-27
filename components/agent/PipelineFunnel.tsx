"use client";

import { useIssues } from "@/lib/hooks";
import type { IssueStatus } from "@/lib/types";

const STAGES: { key: IssueStatus | "monitoring"; label: string; color: string }[] = [
  { key: "reported", label: "Reported", color: "#3b82f6" },
  { key: "monitoring", label: "Agent Monitoring", color: "#8b5cf6" },
  { key: "confirmed", label: "Confirmed", color: "#f59e0b" },
  { key: "in_progress", label: "In Progress", color: "#f97316" },
  { key: "resolved", label: "Resolved", color: "#22c55e" },
];

export function PipelineFunnel() {
  const { data: issues } = useIssues();

  const counts: Record<string, number> = {
    reported: 0,
    monitoring: 0,
    confirmed: 0,
    in_progress: 0,
    resolved: 0,
  };
  for (const i of issues) {
    if (i.isPredicted) continue;
    if (i.status in counts) counts[i.status] = (counts[i.status] ?? 0) + 1;
    if (i.agentReviewCount > 0) counts.monitoring = (counts.monitoring ?? 0) + 1;
  }

  return (
    <div className="space-y-2">
      {STAGES.map((s, idx) => {
        const count = counts[s.key] ?? 0;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className="flex h-12 flex-1 items-center justify-between rounded-lg px-4 text-white shadow-sm transition-all"
              style={{
                backgroundColor: s.color,
                width: `${100 - idx * 8}%`,
                opacity: count === 0 ? 0.4 : 1,
              }}
            >
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xl font-bold tabular-nums">{count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
