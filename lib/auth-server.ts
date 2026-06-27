/**
 * Server-side auth: verify a Supabase access token from the
 * Authorization: Bearer <token> header. Returns the uid, or null.
 */
import { admin } from "./supabase-admin";

export async function getUidFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const { data, error } = await admin().auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch (err) {
    console.error("token verification failed:", err);
    return null;
  }
}
