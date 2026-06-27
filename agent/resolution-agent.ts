/**
 * The Resolution Agent — Gemini 2.0 Flash with function calling.
 *
 * runAgentCycle() drives a multi-step loop: it sends the kickoff message,
 * executes whatever tool calls Gemini returns against Firestore, feeds the
 * results back, and repeats until Gemini stops calling tools. An optional
 * onEvent callback streams each step out to the live activity feed.
 */
import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionCall,
  type Tool,
} from "@google/generative-ai";
import { AGENT_KICKOFF, AGENT_SYSTEM_PROMPT } from "./prompts";
import { executeTool } from "./tools";
import { GEMINI_MODEL } from "@/lib/gemini";
import type { AgentCycleResult } from "@/lib/types";

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_open_issues",
        description: "Fetch all open civic issues filtered by age and status",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            minAgeHours: {
              type: SchemaType.NUMBER,
              description: "Return only issues older than this many hours",
            },
            status: {
              type: SchemaType.STRING,
              description: "Filter by status. Use 'all_open' for all non-resolved.",
            },
            wardId: {
              type: SchemaType.STRING,
              description: "Filter by ward ID. Omit for all wards.",
            },
          },
          required: ["minAgeHours"],
        },
      },
      {
        name: "get_agent_memory",
        description:
          "Check what actions this agent has already taken on a specific issue. ALWAYS call this before taking any action.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { issueId: { type: SchemaType.STRING } },
          required: ["issueId"],
        },
      },
      {
        name: "escalate_issue",
        description: "Send an escalation alert for a stalled high-priority issue",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issueId: { type: SchemaType.STRING },
            department: { type: SchemaType.STRING, description: "Primary dept to escalate to" },
            reason: { type: SchemaType.STRING, description: "Why this issue needs escalation NOW" },
            urgencyLevel: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["normal", "urgent", "critical"],
            },
            alternativeDept: {
              type: SchemaType.STRING,
              description: "Backup dept if primary escalation fails. Required on retry.",
            },
          },
          required: ["issueId", "department", "reason", "urgencyLevel"],
        },
      },
      {
        name: "merge_issues",
        description: "Mark issue B as duplicate of issue A, transfer all verifiers",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            primaryIssueId: { type: SchemaType.STRING },
            duplicateIssueId: { type: SchemaType.STRING },
            reason: { type: SchemaType.STRING },
          },
          required: ["primaryIssueId", "duplicateIssueId", "reason"],
        },
      },
      {
        name: "get_nearby_issues",
        description: "Find issues within a radius to detect duplicates or clusters",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            lat: { type: SchemaType.NUMBER },
            lng: { type: SchemaType.NUMBER },
            radiusMeters: { type: SchemaType.NUMBER },
            category: { type: SchemaType.STRING, description: "Optional category filter" },
          },
          required: ["lat", "lng", "radiusMeters"],
        },
      },
      {
        name: "request_evidence",
        description: "Ask the reporter to provide more details or a clearer photo",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issueId: { type: SchemaType.STRING },
            requestMessage: {
              type: SchemaType.STRING,
              description: "Specific question for reporter",
            },
          },
          required: ["issueId", "requestMessage"],
        },
      },
      {
        name: "flag_low_confidence",
        description: "Flag an issue for human review when AI confidence is below 60%",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issueId: { type: SchemaType.STRING },
            confidence: { type: SchemaType.NUMBER },
            reason: { type: SchemaType.STRING },
          },
          required: ["issueId", "confidence", "reason"],
        },
      },
      {
        name: "update_status",
        description: "Update an issue's status with a reason",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issueId: { type: SchemaType.STRING },
            newStatus: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["confirmed", "in_progress", "resolved", "closed", "needs_review"],
            },
            reason: { type: SchemaType.STRING },
          },
          required: ["issueId", "newStatus", "reason"],
        },
      },
      {
        name: "log_decision",
        description:
          "Log this agent's reasoning and action. MUST be called after every other tool call.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issueId: { type: SchemaType.STRING },
            reasoning: {
              type: SchemaType.STRING,
              description: "Full explanation of why this action was chosen. Be detailed.",
            },
            actionTaken: { type: SchemaType.STRING },
            confidenceScore: { type: SchemaType.NUMBER },
            chainStep: {
              type: SchemaType.NUMBER,
              description: "Step number in this cycle (1, 2, 3...)",
            },
            isSelfCorrection: {
              type: SchemaType.BOOLEAN,
              description: "True if this action corrects a previous failed action",
            },
          },
          required: ["issueId", "reasoning", "actionTaken", "confidenceScore", "chainStep"],
        },
      },
    ],
  },
];

export interface AgentStepEvent {
  type: "tool_call" | "tool_result" | "done" | "error";
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  message?: string;
}

/** Cap loop iterations so a misbehaving model can't run forever. Each turn is
 *  one Gemini request, so this also bounds the cycle within the per-minute
 *  request budget on the free tier. */
const MAX_TURNS = 6;

type Chat = ReturnType<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["startChat"]>;

/**
 * Send a chat turn, retrying transient model errors (503 high-demand, 429
 * rate spikes, 500). Preview models occasionally throw 503 under load; a short
 * backoff almost always clears it. Throws only after exhausting retries.
 */
async function sendWithRetry(
  chat: Chat,
  message: Parameters<Chat["sendMessage"]>[0],
  retries = 3
): Promise<Awaited<ReturnType<Chat["sendMessage"]>>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chat.sendMessage(message);
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? "");
      const transient = /\[(503|429|500)|high demand|overloaded|rate/i.test(msg);
      if (!transient || attempt === retries) throw err;
      // 1.5s, 3s, 6s backoff.
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

export async function runAgentCycle(
  onEvent?: (e: AgentStepEvent) => void
): Promise<AgentCycleResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      actionsCount: 0,
      issuesProcessed: 0,
      selfCorrectionCount: 0,
      newPredictions: 0,
      summary: "GEMINI_API_KEY not configured — agent cannot run.",
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools,
    systemInstruction: AGENT_SYSTEM_PROMPT,
  });

  const chat = model.startChat();
  let totalActions = 0;
  let selfCorrectionCount = 0;
  const touchedIssues = new Set<string>();

  let turns = 0;
  let partial = false;

  try {
    let response = await sendWithRetry(chat, AGENT_KICKOFF);

    while (turns < MAX_TURNS) {
      turns++;
      const calls: FunctionCall[] = response.response.functionCalls() ?? [];
      if (calls.length === 0) break;

      const results = await Promise.all(
        calls.map(async (call) => {
          const args = (call.args ?? {}) as Record<string, unknown>;
          onEvent?.({ type: "tool_call", name: call.name, args });

          const result = await executeTool(call.name, args);

          if (call.name === "log_decision") {
            if (args.isSelfCorrection) selfCorrectionCount++;
          } else {
            totalActions++;
          }
          if (typeof args.issueId === "string") touchedIssues.add(args.issueId);
          if (typeof args.primaryIssueId === "string") touchedIssues.add(args.primaryIssueId);

          onEvent?.({ type: "tool_result", name: call.name, result });
          return { functionResponse: { name: call.name, response: result } };
        })
      );

      response = await sendWithRetry(chat, results);
    }
  } catch (err) {
    // A late transient failure shouldn't discard the work already committed to
    // Firestore. Report what completed and let the route finish housekeeping.
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
    newPredictions: 0, // filled in by the route after running predictions
    summary,
  };
}
