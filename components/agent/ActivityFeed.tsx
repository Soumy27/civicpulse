"use client";

import { useAgentActivity } from "@/lib/hooks";
import { relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS, type IssueCategory } from "@/lib/types";
import { AlertTriangle, GitMerge, MessageSquare, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

const ACTION_ICON: Record<string, React.ReactNode> = {
  escalate: <ShieldAlert className="h-4 w-4" />,
  merge: <GitMerge className="h-4 w-4" />,
  request: <MessageSquare className="h-4 w-4" />,
  flag: <AlertTriangle className="h-4 w-4" />,
  close: <XCircle className="h-4 w-4" />,
};

function iconForAction(action: string): React.ReactNode {
  const a = action.toLowerCase();
  if (a.includes("escalat")) return ACTION_ICON.escalate;
  if (a.includes("merge")) return ACTION_ICON.merge;
  if (a.includes("evidence") || a.includes("request")) return ACTION_ICON.request;
  if (a.includes("flag") || a.includes("review")) return ACTION_ICON.flag;
  if (a.includes("close")) return ACTION_ICON.close;
  return <RefreshCw className="h-4 w-4" />;
}

function SkeletonRow() {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="shimmer h-4 w-1/3 rounded" />
      <div className="shimmer h-3 w-full rounded" />
      <div className="shimmer h-3 w-2/3 rounded" />
    </div>
  );
}

export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const { data, loading } = useAgentActivity(compact ? 20 : 60);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        No agent activity yet. Click <span className="font-semibold">Run Agent Now</span> to
        watch the Resolution Agent reason through open issues.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((a) => {
        const color = CATEGORY_COLORS[(a.issueCategory as IssueCategory) ?? "other"] ?? "#64748b";
        return (
          <div
            key={a.id}
            className="animate-slide-in-right rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${color}1a`, color }}
                >
                  {iconForAction(a.actionTaken)}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold capitalize">
                    {a.issueCategory.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.issueAddress || a.issueId}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.chainStep > 0 && (
                  <Badge variant="secondary">Step {a.chainStep}</Badge>
                )}
                {a.isSelfCorrection && (
                  <Badge variant="amber">
                    <RefreshCw className="h-3 w-3" /> Self-correction
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {relativeTime(a.timestamp)}
                </span>
              </div>
            </div>

            <Badge variant="blue" className="mb-2">
              {a.actionTaken}
            </Badge>

            <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed text-foreground">
              <span className="font-semibold text-muted-foreground">Reasoning: </span>
              {a.reasoning}
            </p>

            <div className="mt-2 text-xs text-muted-foreground">
              Confidence: <span className="font-semibold">{Math.round(a.confidenceScore)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
