/**
 * Cloud Natural Language API wrapper — entity extraction from issue
 * descriptions (street names, landmarks, location markers). Degrades
 * gracefully: if the API is unconfigured or fails, returns [] so the
 * report flow never breaks.
 */
import { LanguageServiceClient } from "@google-cloud/language";

let _client: LanguageServiceClient | null = null;

function client(): LanguageServiceClient | null {
  if (_client) return _client;
  try {
    // Reuse the Firebase admin service account if no dedicated creds set.
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      _client = new LanguageServiceClient();
    } else if (projectId && clientEmail && privateKey) {
      _client = new LanguageServiceClient({
        projectId,
        credentials: { client_email: clientEmail, private_key: privateKey },
      });
    } else {
      return null;
    }
    return _client;
  } catch (err) {
    console.error("NL client init failed:", err);
    return null;
  }
}

/**
 * Extract notable entities (locations, landmarks, organizations, etc.) from a
 * free-text description. Filters to the entity types useful for civic context
 * and de-duplicates.
 */
export async function extractEntities(text: string): Promise<string[]> {
  const c = client();
  if (!c || !text.trim()) return [];
  try {
    const [result] = await c.analyzeEntities({
      document: { content: text, type: "PLAIN_TEXT" },
    });
    const useful = new Set(["LOCATION", "ADDRESS", "ORGANIZATION", "OTHER", "EVENT"]);
    const names = (result.entities ?? [])
      .filter((e) => useful.has(String(e.type)))
      .map((e) => e.name ?? "")
      .filter(Boolean);
    return Array.from(new Set(names)).slice(0, 6);
  } catch (err) {
    console.error("NL analyzeEntities failed:", err);
    return [];
  }
}
