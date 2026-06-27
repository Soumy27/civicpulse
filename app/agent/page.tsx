"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/agent/ActivityFeed";
import { RunAgentButton } from "@/components/agent/RunAgentButton";
import { PipelineFunnel } from "@/components/agent/PipelineFunnel";
import { AgentStats } from "@/components/agent/AgentStats";

export default function AgentPage() {
  const [cyclesBump, setCyclesBump] = useState(0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">Resolution Agent</h1>
        <p className="text-sm text-muted-foreground">
          An autonomous Gemini agent that monitors civic issues, reasons step-by-step, takes
          action, and self-corrects — with full memory across cycles.
        </p>
      </div>

      <AgentStats cyclesBump={cyclesBump} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Run a cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <RunAgentButton onResult={() => setCyclesBump((n) => n + 1)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineFunnel />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent activity feed</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed />
        </CardContent>
      </Card>
    </div>
  );
}
