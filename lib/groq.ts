/**
 * Groq client wrapper (OpenAI-compatible). Centralizes model choice and JSON
 * parsing. Models are env-overridable so a deprecated Groq model is a config
 * change, not a code change.
 */
import Groq from "groq-sdk";

// llama-3.3-70b is reliable for tool-calling (the agent); Llama 4 Scout is
// multimodal for photo classification.
export const AGENT_MODEL = process.env.GROQ_AGENT_MODEL ?? "llama-3.3-70b-versatile";
export const VISION_MODEL =
  process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
export const TEXT_MODEL = process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";

let _client: Groq | null = null;

export function groq(): Groq {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  _client = new Groq({ apiKey });
  return _client;
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/** Strip fences / prose and parse the first JSON object. */
export function parseJsonFromModel<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  let cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/** Text prompt → string (or null on error). Requests JSON object mode. */
export async function generateText(prompt: string, json = true): Promise<string | null> {
  try {
    const res = await groq().chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });
    return res.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("Groq generateText failed:", err);
    return null;
  }
}

/** Vision prompt + inline base64 image → string. */
export async function generateFromImage(
  prompt: string,
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<string | null> {
  try {
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;
    const res = await groq().chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.3,
    });
    return res.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("Groq generateFromImage failed:", err);
    return null;
  }
}

export function mimeFromDataUrl(input: string): string {
  const m = /^data:([^;]+);/.exec(input);
  return m?.[1] ?? "image/jpeg";
}

export function stripDataUrl(input: string): string {
  const comma = input.indexOf(",");
  if (input.startsWith("data:") && comma !== -1) return input.slice(comma + 1);
  return input;
}
