/**
 * Server-side auth helper. Verifies a Firebase ID token from the
 * Authorization: Bearer <token> header. Returns the uid, or null if absent /
 * invalid. Routes decide whether null is acceptable (demo) or a 401.
 */
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "./firebase-admin";

export async function getUidFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error("ID token verification failed:", err);
    return null;
  }
}
