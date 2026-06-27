"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useAgentActivity, useIssues } from "@/lib/hooks";
import { StatCard } from "./StatCard";

/**
 * Derives the four headline agent metrics live from Firestore:
 *  - cycles run (tracked in localStorage; agent runs are demo-triggered)
 *  - total actions taken (agentActivity entries with a real action)
 *  - self-corrections (isSelfCorrection entries)
 *  - new predictions (issues with isPredicted)
 */
export function AgentStats({ cyclesBump = 0 }: { cyclesBump?: number }) {
  const { data: activity } = useAgentActivity(200);
  const { data: issues } = useIssues();
  const [cycles, setCycles] = useState(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem("cp_agent_cycles") ?? "0");
    setCycles(stored);
  }, []);

  useEffect(() => {
    if (cyclesBump > 0) {
      const next = Number(localStorage.getItem("cp_agent_cycles") ?? "0") + 1;
      localStorage.setItem("cp_agent_cycles", String(next));
      setCycles(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyclesBump]);

  const totalActions = activity.filter((a) => !a.actionTaken.toLowerCase().includes("logged")).length;
  const selfCorrections = activity.filter((a) => a.isSelfCorrection).length;
  const predictions = issues.filter((i) => i.isPredicted).length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Cycles Run" value={cycles} icon={<Activity className="h-4 w-4 text-primary" />} />
      <StatCard
        label="Actions Taken"
        value={totalActions}
        accent="text-blue-600"
        icon={<Zap className="h-4 w-4 text-blue-600" />}
      />
      <StatCard
        label="Self-Corrections"
        value={selfCorrections}
        accent="text-amber-600"
        icon={<RefreshCw className="h-4 w-4 text-amber-600" />}
      />
      <StatCard
        label="Predictions"
        value={predictions}
        accent="text-violet-600"
        icon={<Sparkles className="h-4 w-4 text-violet-600" />}
      />
    </div>
  );
}
