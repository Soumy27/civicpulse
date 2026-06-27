"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useIssues } from "@/lib/hooks";
import { CivicScoreHeader } from "@/components/shared/CivicScoreHeader";
import { IssueMap } from "@/components/map/IssueMap";
import { IssuePanel } from "@/components/map/IssuePanel";
import { ActivityFeed } from "@/components/agent/ActivityFeed";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { relativeTime } from "@/lib/utils";
import type { Issue } from "@/lib/types";

type Tab = "issues" | "agent";

export default function HomePage() {
  const { data: issues } = useIssues();
  const [selected, setSelected] = useState<Issue | null>(null);
  const [tab, setTab] = useState<Tab>("issues");

  const liveIssues = useMemo(
    () => issues.filter((i) => !i.isPredicted && !i.mergedIntoIssueId),
    [issues]
  );
  const openCount = liveIssues.filter((i) =>
    ["reported", "confirmed", "in_progress", "needs_review"].includes(i.status)
  ).length;

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div>
          <h1 className="text-xl font-bold">Indore Live Issue Map</h1>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {issues.filter((i) => i.isPredicted).length} AI-predicted hotspots
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CivicScoreHeader />
          <Link
            href="/report"
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Report
          </Link>
        </div>
      </div>

      {/* Split: map 65 / activity 35 */}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[65%_35%]">
        <div className="relative h-[55vh] lg:h-[calc(100vh-7.5rem)]">
          <IssueMap issues={issues} onSelect={setSelected} selectedId={selected?.id} />
          {selected && (
            <div className="absolute bottom-3 left-3 right-3 z-20 max-w-sm lg:right-auto lg:w-80">
              <IssuePanel issue={selected} onClose={() => setSelected(null)} />
            </div>
          )}
          <div className="absolute left-3 top-3 z-10 rounded-lg bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
            {openCount} open issues
          </div>
        </div>

        <div className="flex h-[calc(100vh-7.5rem)] flex-col border-l">
          <div className="flex border-b">
            {(["issues", "agent"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "issues" ? "Live Issues" : "Agent Activity"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {tab === "issues" ? (
              <div className="space-y-2">
                {liveIssues.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setSelected(i)}
                    className="w-full rounded-xl border bg-card p-3 text-left shadow-sm hover:bg-accent"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <CategoryBadge category={i.category} />
                      <StatusBadge status={i.status} />
                    </div>
                    <p className="line-clamp-1 text-sm">{i.aiDescription}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.address} · {relativeTime(i.createdAt)}
                    </p>
                  </button>
                ))}
                {liveIssues.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No issues yet. Run the seed script or report one.
                  </p>
                )}
              </div>
            ) : (
              <ActivityFeed compact />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
