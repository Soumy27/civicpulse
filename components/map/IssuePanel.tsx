"use client";

import Link from "next/link";
import Image from "next/image";
import { Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Issue } from "@/lib/types";

export function IssuePanel({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  if (issue.isPredicted) {
    return (
      <div className="space-y-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
        <div className="flex items-center justify-between">
          <Badge variant="amber">
            <Sparkles className="h-3 w-3" /> AI Prediction
          </Badge>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-medium text-amber-900">
          AI predicts a {issue.predictedCategory?.replace("_", " ") ?? issue.category} likely here
          based on {issue.basedOnCount ?? 0} historical repairs in this zone.
        </p>
        <p className="text-xs text-amber-800">{issue.historicalPattern}</p>
        <div className="rounded-lg bg-white/70 p-2 text-xs text-amber-800">
          Pre-emptive alert sent to {issue.department}. Confidence{" "}
          {issue.predictionConfidence ?? issue.aiConfidence}%.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap gap-2">
          <CategoryBadge category={issue.category} />
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {issue.photoUrl && (
        <div className="relative h-40 w-full overflow-hidden rounded-lg">
          <Image src={issue.photoUrl} alt={issue.category} fill className="object-cover" unoptimized />
        </div>
      )}

      <p className="text-sm">{issue.aiDescription}</p>
      <p className="text-xs text-muted-foreground">{issue.address}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{issue.verificationCount} verifications</span>
        <span>Routed to {issue.department}</span>
      </div>

      <Link
        href={`/issue/${issue.id}`}
        className="block rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        View details &amp; verify
      </Link>
    </div>
  );
}
