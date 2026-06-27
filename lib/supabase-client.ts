"use client";

/**
 * Supabase browser client — anon key. Used for realtime subscriptions and
 * auth. Returns null if env is unset so the UI degrades gracefully.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

export const T = {
  issues: "issues",
  activity: "agent_activity",
  memory: "agent_memory",
  profiles: "profiles",
  wards: "wards",
  metrics: "city_metrics",
} as const;
