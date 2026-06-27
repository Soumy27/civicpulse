/**
 * The Resolution Agent — Groq (Llama 3.3 70B) with OpenAI-style tool calling.
 *
 * runAgentCycle() drives a multi-step loop: sends the batched kickoff, executes
 * whatever tool calls the model returns against Supabase, feeds the results
 * back, and repeats until no more tool calls. Parallel tool calls in one turn
 * count as a single request, which keeps the cycle inside the rate budget.
 */
import type Groq from "groq-sdk";
import { AGENT_KICKOFF, AGENT_SYSTEM_PROMPT } from "./prompts";
import { executeTool } from "./tools";
import { groq, AGENT_MODEL } from "@/lib/groq";
import type { AgentCycleResult } from "@/lib/types";

type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam;
type Tool = Groq.Chat.Completions.ChatCompletionTool;

const tools: Tool[] = [
  fn("get_open_issues", "Fetch all open civic issues filtered by age and status", {
    minAgeHours: { type: "number", description: "Return only issues older than this many hours" },
    status: { type: "string", description: "Filter by status. Use 'all_open' for all non-resolved." },
    wardId: { type: "string", description: "Filter by ward ID. Omit for all wards." },
  }, ["minAgeHours"]),
  fn("get_agent_memory", "Check what actions the agent already took on an issue. ALWAYS call before acting.", {
    issueId: { type: "string" },
  }, ["issueId"]),
  fn("escalate_issue", "Send an escalation alert for a stalled high-priority issue", {
    issueId: { type: "string" },
    department: { type: "string", description: "Primary dept to escalate to" },
    reason: { type: "string", description: "Why this issue needs escalation NOW" },
    urgencyLevel: { type: "string", enum: ["normal", "urgent", "critical"] },
    alternativeDept: { type: "string", description: "Backup dept if primary fails. Required on retry." },
  }, ["issueId", "department", "reason", "urgencyLevel"]),
  fn("merge_issues", "Mark issue B as duplicate of issue A, transfer all verifiers", {
    primaryIssueId: { type: "string" },
    duplicateIssueId: { type: "string" },
    reason: { type: "string" },
  }, ["primaryIssueId", "duplicateIssueId", "reason"]),
  fn("get_nearby_issues", "Find issues within a radius to detect duplicates or clusters", {
    lat: { type: "number" },
    lng: { type: "number" },
    radiusMeters: { type: "number" },
    category: { type: "string", description: "Optional category filter" },
  }, ["lat", "lng", "radiusMeters"]),
  fn("request_evidence", "Ask the reporter for more details or a clearer photo", {
    issueId: { type: "string" },
    requestMessage: { type: "string", description: "Specific question for reporter" },
  }, ["issueId", "requestMessage"]),
  fn("flag_low_confidence", "Flag an issue for human review when AI confidence is below 60%", {
    issueId: { type: "string" },
    confidence: { type: "number" },
    reason: { type: "string" },
  }, ["issueId", "confidence", "reason"]),
  fn("update_status", "Update an issue's status with a reason", {
    issueId: { type: "string" },
    newStatus: { type: "string", enum: ["confirmed", "in_progress", "resolved", "closed", "needs_review"] },
    reason: { type: "string" },
  }, ["issueId", "newStatus", "reason"]),
  fn("log_decision", "Log the agent's reasoning and action. MUST be called after every other tool call.", {
    issueId: { type: "string" },
    reasoning: { type: "string", description: "Full explanation of why this action was chosen." },
    actionTaken: { type: "string" },
    confidenceScore: { type: "number" },
    chainStep: { type: "number", description: "Step number in this cycle (1, 2, 3...)" },
    isSelfCorrection: { type: "boolean", description: "True if this corrects a previous failed action" },
  }, ["issueId", "reasoning", "actionTaken", "confidenceScore", "chainStep"]),
];

function fn(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[]
): Tool {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

export interface AgentStepEvent {
  type: "tool_call" | "tool_result" | "done" | "error";
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  message?: string;
}

const MAX_TURNS = 6;

async function createWithRetry(
  messages: ChatMessage[],
  retries = 3
): Promise<Groq.Chat.Completions.ChatCompletion> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await groq().chat.completions.create({
        model: AGENT_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 1024,
      });
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? "");
      const transient = /\b(429|500|502|503)\b|rate|overload|timeout/i.test(msg);
      if (!transient || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

export async function runAgentCycle(
  onEvent?: (e: AgentStepEvent) => void
): Promise<AgentCycleResult> {
  if (!process.env.GROQ_API_KEY) {
    return {
      actionsCount: 0,
      issuesProcessed: 0,
      selfCorrectionCount: 0,
      newPredictions: 0,
      summary: "GROQ_API_KEY not configured — agent cannot run.",
    };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: AGENT_KICKOFF },
  ];

  let totalActions = 0;
  let selfCorrectionCount = 0;
  const touchedIssues = new Set<string>();
  let partial = false;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await createWithRetry(messages);
      const msg = res.choices[0]?.message;
      if (!msg) break;
      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) break;

      // Record the assistant turn (with its tool calls) before the results.
      messages.push(msg as ChatMessage);

      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* malformed args */
        }
        onEvent?.({ type: "tool_call", name: call.function.name, args });

        const result = await executeTool(call.function.name, args);

        if (call.function.name === "log_decision") {
          if (args.isSelfCorrection) selfCorrectionCount++;
        } else {
          totalActions++;
        }
        if (typeof args.issueId === "string") touchedIssues.add(args.issueId);
        if (typeof args.primaryIssueId === "string") touchedIssues.add(args.primaryIssueId);

        onEvent?.({ type: "tool_result", name: call.function.name, result });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
  } catch (err) {
    console.error("Agent loop ended early (transient):", (err as Error).message);
    partial = true;
    onEvent?.({ type: "error", message: "Model paused mid-cycle; returning completed actions." });
  }

  const summary =
    `Agent ${partial ? "partially completed" : "completed"} a cycle: ${totalActions} action(s) across ` +
    `${touchedIssues.size} issue(s), ${selfCorrectionCount} self-correction(s).`;
  onEvent?.({ type: "done", message: summary });

  return {
    actionsCount: totalActions,
    issuesProcessed: touchedIssues.size,
    selfCorrectionCount,
    newPredictions: 0,
    summary,
  };
}
