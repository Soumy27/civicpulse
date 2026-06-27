/**
 * Cloud Pub/Sub publisher — event-driven agent triggers. Publishing a
 * 'new-issues' message lets a subscriber (e.g. a Cloud Run worker) kick off
 * an agent cycle. Degrades to a no-op if Pub/Sub isn't configured so the
 * report flow never blocks on it.
 */
import { PubSub } from "@google-cloud/pubsub";

let _pubsub: PubSub | null = null;

function client(): PubSub | null {
  if (_pubsub) return _pubsub;
  try {
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId) return null;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      _pubsub = new PubSub({ projectId });
    } else if (clientEmail && privateKey) {
      _pubsub = new PubSub({
        projectId,
        credentials: { client_email: clientEmail, private_key: privateKey },
      });
    } else {
      return null;
    }
    return _pubsub;
  } catch (err) {
    console.error("PubSub init failed:", err);
    return null;
  }
}

export async function publishNewIssue(issueId: string, data: Record<string, unknown>): Promise<void> {
  const c = client();
  const topic = process.env.PUBSUB_TOPIC_NEW_ISSUES ?? "new-issues";
  if (!c) return;
  try {
    await c.topic(topic).publishMessage({ json: { issueId, ...data } });
  } catch (err) {
    // Topic may not exist yet in a fresh project — log and continue.
    console.error("PubSub publish failed:", err);
  }
}
