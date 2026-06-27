"use client";

import Link from "next/link";
import { AlertTriangle, Building2, Clock, Info, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import type { ClassifyResult } from "@/lib/types";

interface AiPreviewCardProps {
  result: ClassifyResult;
  description: string;
  onDescriptionChange: (v: string) => void;
}

export function AiPreviewCard({ result, description, onDescriptionChange }: AiPreviewCardProps) {
  const lowConfidence = result.confidence < 60 || result.needsReview;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={result.category} />
            <SeverityBadge severity={result.severity} />
            <ConfidenceBadge confidence={result.confidence} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AI description (editable)
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Will be sent to:</span>
            <span className="font-medium">{result.department}</span>
          </div>

          {result.predictedResolutionMaxDays > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <Clock className="h-4 w-4" />
              Typically resolved in{" "}
              <span className="font-semibold">
                {result.predictedResolutionMinDays}–{result.predictedResolutionMaxDays} days
              </span>{" "}
              based on your ward&apos;s history
            </div>
          )}

          {result.extractedEntities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Near:</span>
              {result.extractedEntities.map((e) => (
                <Badge key={e} variant="secondary">
                  {e}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lowConfidence && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            AI couldn&apos;t clearly identify this issue. Your report will be reviewed manually.
            You can add a description above to help.
          </span>
        </div>
      )}

      {result.nearbyIssues.length > 0 && (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-center gap-2 font-medium">
            <Info className="h-4 w-4" /> Similar report{result.nearbyIssues.length > 1 ? "s" : ""} nearby
          </div>
          {result.nearbyIssues.map((i) => (
            <Link
              key={i.id}
              href={`/issue/${i.id}`}
              className="block rounded-lg bg-white/70 px-3 py-2 hover:bg-white"
            >
              {i.aiDescription || i.category} · {i.verificationCount} verifications
            </Link>
          ))}
          <p className="text-xs">Verifying the existing report helps more than a duplicate.</p>
        </div>
      )}
    </div>
  );
}
