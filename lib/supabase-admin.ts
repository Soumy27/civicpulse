/**
 * Supabase admin client — server-side only. Uses the service-role key, which
 * bypasses RLS, so all writes (API routes, agent tools, seed) go through here.
 * Never import this from a client component.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin credentials missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** Table name constants so a rename is one edit. */
export const T = {
  issues: "issues",
  activity: "agent_activity",
  memory: "agent_memory",
  profiles: "profiles",
  wards: "wards",
  metrics: "city_metrics",
} as const;
