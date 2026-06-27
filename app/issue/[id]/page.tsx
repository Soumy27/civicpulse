"use client";

import Image from "next/image";
import { MapPin, Users } from "lucide-react";
import { useIssue } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { MiniMap } from "@/components/map/MiniMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBadge";
import { StatusTimeline } from "@/components/issue/StatusTimeline";
import { VerifyButton } from "@/components/issue/VerifyButton";
import { AgentHistory } from "@/components/issue/AgentHistory";
import { EscalationCard } from "@/components/issue/EscalationCard";

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: issue, loading } = useIssue(id);
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="shimmer h-64 w-full rounded-xl" />
        <div className="shimmer h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-muted-foreground">
        Issue not found.
      </div>
    );
  }

  const isReporter = user?.uid === issue.reporterId;
  const alreadyVerified = user ? issue.verifierIds.includes(user.uid) : false;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      {/* Photo */}
      <div className="relative h-64 w-full overflow-hidden rounded-xl bg-muted sm:h-80">
        {issue.photoUrl ? (
          <Image src={issue.photoUrl} alt={issue.category} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No photo
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <CategoryBadge category={issue.category} />
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          <StatusTimeline
            status={issue.status}
            createdAt={issue.createdAt}
            updatedAt={issue.updatedAt}
          />
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{issue.aiDescription}</p>
            <div className="text-sm text-muted-foreground">
              Routed to <span className="font-medium text-foreground">{issue.department}</span>
            </div>
            <ConfidenceBar confidence={issue.aiConfidence} />
            {issue.predictedResolutionMaxDays > 0 && (
              <p className="text-sm text-muted-foreground">
                Predicted resolution:{" "}
                <span className="font-medium text-foreground">
                  {issue.predictedResolutionMinDays}–{issue.predictedResolutionMaxDays} days
                </span>
              </p>
            )}
            {issue.extractedEntities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {issue.extractedEntities.map((e) => (
                  <Badge key={e} variant="secondary">
                    {e}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-40 w-full overflow-hidden rounded-lg">
              <MiniMap lat={issue.lat} lng={issue.lng} />
            </div>
            <p className="text-sm text-muted-foreground">{issue.address}</p>
          </CardContent>
        </Card>
      </div>

      {/* Verify */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="font-medium text-foreground">{issue.verificationCount}</span> people
            confirmed this
          </div>
          <VerifyButton
            issueId={issue.id}
            reporterId={issue.reporterId}
            alreadyVerified={alreadyVerified}
          />
        </CardContent>
      </Card>

      {/* Agent history */}
      <AgentHistory issueId={issue.id} reviewCount={issue.agentReviewCount} />

      {/* Escalation (reporter only) */}
      {isReporter && <EscalationCard issueId={issue.id} />}
    </div>
  );
}
