/**
 * Thin Gemini client wrapper. Centralizes model creation and JSON parsing so
 * every caller (classify, prediction, escalation drafts, the agent) shares
 * the same hardened parsing and graceful-failure behavior.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini 3 Flash — has available quota on the project key (2.0-flash free tier
// was capped at 0). Standard generateContent + function calling + vision, which
// the agent, classifier and drafting all use. Transient 503 "high demand"
// blips under load are absorbed by sendWithRetry + partial-result handling.
// (gemini-3.5-flash is a drop-in alternative if the preview gets flaky.)
export const GEMINI_MODEL = "gemini-3-flash-preview";

let _genAI: GoogleGenerativeAI | null = null;

export function genAI(): GoogleGenerativeAI {
  if (_genAI) return _genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Strip markdown fences / preamble and parse the first JSON object found.
 * Gemini sometimes wraps JSON in ```json blocks despite instructions.
 */
export function parseJsonFromModel<T>(text: string): T | null {
  if (!text) return null;
  let cleaned = text.trim();
  // Remove ```json ... ``` or ``` ... ``` fences.
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // Find the first { ... } block if there's surrounding prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/** Run a text-only Gemini prompt, returning the raw string (or null on error). */
export async function generateText(prompt: string): Promise<string | null> {
  try {
    const model = genAI().getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini generateText failed:", err);
    return null;
  }
}

/** Run a vision prompt with an inline base64 image. */
export async function generateFromImage(
  prompt: string,
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<string | null> {
  try {
    const model = genAI().getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: stripDataUrl(imageBase64), mimeType } },
    ]);
    return result.response.text();
  } catch (err) {
    console.error("Gemini generateFromImage failed:", err);
    return null;
  }
}

/** Accept either a raw base64 string or a full data: URL. */
export function stripDataUrl(input: string): string {
  const comma = input.indexOf(",");
  if (input.startsWith("data:") && comma !== -1) return input.slice(comma + 1);
  return input;
}

export function mimeFromDataUrl(input: string): string {
  const match = /^data:([^;]+);/.exec(input);
  return match?.[1] ?? "image/jpeg";
}
