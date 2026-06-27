"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useIssuesByWard, useWard } from "@/lib/hooks";
import { ageInDays } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthScore } from "@/components/ward/HealthScore";
import { CategoryChart } from "@/components/ward/CategoryChart";
import { Leaderboard } from "@/components/ward/Leaderboard";
import { StatCard } from "@/components/agent/StatCard";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const;

export default function WardPage({ params }: { params: { wardId: string } }) {
  const { wardId } = params;
  const { data: ward } = useWard(wardId);
  const { data: issues } = useIssuesByWard(wardId);

  const real = useMemo(() => issues.filter((i) => !i.isPredicted), [issues]);
  const resolved = real.filter((i) => i.status === "resolved").length;
  const confirmed = real.filter((i) => i.status === "confirmed").length;
  const resolvedPct = real.length ? Math.round((resolved / real.length) * 100) : 0;

  const avgDays = useMemo(() => {
    const done = real.filter((i) => i.status === "resolved");
    if (!done.length) return ward?.avgResolutionDays ?? 0;
    const sum = done.reduce((s, i) => s + ageInDays(i.createdAt, i.updatedAt), 0);
    return Math.round((sum / done.length) * 10) / 10;
  }, [real, ward]);

  const sorted = useMemo(
    () =>
      [...real].sort((a, b) => {
        const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        return sev !== 0 ? sev : a.createdAt - b.createdAt;
      }),
    [real]
  );

  const healthScore = ward?.healthScore ?? Math.round(50 + resolvedPct / 2);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{ward?.wardName ?? `Ward ${wardId}`}</h1>
          <p className="text-sm text-muted-foreground">Ward health dashboard</p>
        </div>
        <HealthScore score={healthScore} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reported" value={real.length} />
        <StatCard label="Confirmed" value={confirmed} accent="text-amber-600" />
        <StatCard label="Avg Resolution" value={`${avgDays}d`} accent="text-blue-600" />
        <StatCard label="Resolved %" value={`${resolvedPct}%`} accent="text-green-600" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart issues={real} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top citizens</CardTitle>
          </CardHeader>
          <CardContent>
            <Leaderboard />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issues ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((i) => (
            <Link
              key={i.id}
              href={`/issue/${i.id}`}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <CategoryBadge category={i.category} />
                <span className="text-sm text-muted-foreground">{i.address}</span>
              </div>
              <StatusBadge status={i.status} />
            </Link>
          ))}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No issues in this ward yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
