"use client";

import { useState } from "react";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RunResult {
  actionsCount: number;
  issuesProcessed: number;
  selfCorrectionCount: number;
  newPredictions: number;
  civicScore?: number;
  summary: string;
  error?: boolean;
}

const STATUS_LINES = [
  "Reading open issues from Firestore…",
  "Checking agent memory…",
  "Reasoning about severity & age…",
  "Taking actions…",
  "Self-correcting failed escalations…",
  "Running predictive hotspot scan…",
];

export function RunAgentButton({ onResult }: { onResult?: (r: RunResult) => void }) {
  const [running, setRunning] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [liveCalls, setLiveCalls] = useState<string[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    setLiveCalls([]);
    setStatusIdx(0);
    const ticker = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_LINES.length),
      1400
    );

    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.kind === "event" && evt.type === "tool_call" && evt.name) {
              setLiveCalls((prev) => [`${evt.name}`, ...prev].slice(0, 8));
            }
            if (evt.kind === "result") {
              setResult(evt);
              onResult?.(evt);
            }
          } catch {
            /* partial line, ignore */
          }
        }
      }
    } catch (err) {
      console.error("Agent run failed:", err);
      setResult({
        actionsCount: 0,
        issuesProcessed: 0,
        selfCorrectionCount: 0,
        newPredictions: 0,
        error: true,
        summary: "Could not reach the agent. Check GEMINI_API_KEY and Firebase config.",
      });
    } finally {
      clearInterval(ticker);
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button size="xl" onClick={run} disabled={running} className="w-full">
        {running ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Agent is reasoning…
          </>
        ) : (
          <>
            <Play className="h-5 w-5" /> Run Agent Now
          </>
        )}
      </Button>

      {running && (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4 animate-pulse-soft" />
            {STATUS_LINES[statusIdx]}
          </div>
          {liveCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {liveCalls.map((c, i) => (
                <Badge key={`${c}-${i}`} variant="secondary" className="font-mono text-[11px]">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {result && (
        <div
          className={`animate-slide-in-bottom rounded-xl border p-4 ${
            result.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
          }`}
        >
          {result.error ? (
            <p className="text-sm text-red-700">{result.summary}</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-green-800">{result.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">{result.actionsCount} actions</Badge>
                <Badge variant="blue">{result.issuesProcessed} issues</Badge>
                <Badge variant="amber">{result.selfCorrectionCount} self-corrections</Badge>
                <Badge variant="default">{result.newPredictions} new predictions</Badge>
                {typeof result.civicScore === "number" && (
                  <Badge variant="secondary">Civic Score → {result.civicScore}</Badge>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
