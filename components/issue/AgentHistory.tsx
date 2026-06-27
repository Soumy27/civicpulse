"use client";

import { useState } from "react";
import { Bot, ChevronDown, RefreshCw } from "lucide-react";
import { useIssueActivity } from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

export function AgentHistory({ issueId, reviewCount }: { issueId: string; reviewCount: number }) {
  const { data } = useIssueActivity(issueId);
  const [open, setOpen] = useState(false);

  const entries = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const count = reviewCount || entries.length;
  if (count === 0) return null;

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4 text-primary" />
          Resolution Agent reviewed this issue {count} time{count > 1 ? "s" : ""}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t p-4">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No detailed decisions logged yet.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="blue">{e.actionTaken}</Badge>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {e.isSelfCorrection && (
                    <Badge variant="amber">
                      <RefreshCw className="h-3 w-3" /> self-correction
                    </Badge>
                  )}
                  Step {e.chainStep} · {relativeTime(e.timestamp)}
                </span>
              </div>
              <p className="text-muted-foreground">{e.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
