/**
 * Firebase Cloud Messaging — server-side push. Officers and reporters receive
 * pushes when the agent escalates, requests evidence, or merges. Degrades
 * gracefully: if a token is missing or send fails, we log and continue so the
 * agent cycle never aborts on a notification error.
 */
import { getMessaging } from "firebase-admin/messaging";
import { adminApp, db } from "./firebase-admin";

export async function sendToToken(
  token: string | undefined | null,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  if (!token) return false;
  try {
    await getMessaging(adminApp()).send({
      token,
      notification: { title, body },
      data,
    });
    return true;
  } catch (err) {
    console.error("FCM send failed:", err);
    return false;
  }
}

/** Look up a user's fcmToken and push to them. */
export async function sendToUser(
  uid: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  try {
    const snap = await db().collection("users").doc(uid).get();
    const token = snap.exists ? (snap.data()?.fcmToken as string | undefined) : undefined;
    return sendToToken(token, title, body, data);
  } catch (err) {
    console.error("FCM sendToUser failed:", err);
    return false;
  }
}

/**
 * Officers don't have user docs in the demo; we model a department → token
 * map in the `departments` collection (optional). Missing tokens just no-op.
 */
export async function sendToDepartment(
  department: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  try {
    const snap = await db().collection("departments").doc(slug(department)).get();
    const token = snap.exists ? (snap.data()?.fcmToken as string | undefined) : undefined;
    return sendToToken(token, title, body, data);
  } catch (err) {
    console.error("FCM sendToDepartment failed:", err);
    return false;
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
