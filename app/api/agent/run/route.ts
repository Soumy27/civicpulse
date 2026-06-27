/**
 * POST /api/agent/run — runs one Resolution-Agent cycle and streams progress.
 *
 * The response is a stream of newline-delimited JSON events so the /agent page
 * can render the reasoning chain as it happens. The final event carries the
 * full cycle summary (actions, self-corrections, new predictions).
 *
 * Auth is intentionally open for the live demo.
 */
import { runAgentCycle, type AgentStepEvent } from "@/agent/resolution-agent";
import { recomputeAndPersistCivicScore } from "@/lib/civicScore";
import { runPredictions } from "@/lib/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const onEvent = (e: AgentStepEvent) => send({ kind: "event", ...e });

        const cycle = await runAgentCycle(onEvent);

        // End-of-cycle housekeeping: predictions + civic score recompute.
        send({ kind: "event", type: "tool_call", name: "run_predictions" });
        const predictions = await runPredictions();
        send({ kind: "event", type: "tool_result", name: "run_predictions", result: predictions });

        const metrics = await recomputeAndPersistCivicScore();

        send({
          kind: "result",
          actionsCount: cycle.actionsCount,
          issuesProcessed: cycle.issuesProcessed,
          selfCorrectionCount: cycle.selfCorrectionCount,
          newPredictions: predictions.newPredictions,
          civicScore: metrics.civicScore,
          summary:
            cycle.summary +
            (predictions.newPredictions > 0
              ? ` Generated ${predictions.newPredictions} new prediction(s).`
              : ""),
        });
      } catch (err) {
        console.error("Agent run failed:", err);
        send({
          kind: "result",
          actionsCount: 0,
          issuesProcessed: 0,
          selfCorrectionCount: 0,
          newPredictions: 0,
          error: true,
          summary: "Agent run failed: " + (err as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
