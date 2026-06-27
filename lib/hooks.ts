"use client";

import { useEffect, useState } from "react";
import { supabase, T } from "./supabase-client";
import { rowToIssue, rowToActivity, rowToProfile } from "./serialize-client";
import type { AgentActivity, CityMetrics, Issue, UserProfile, Ward } from "./types";

type Row = Record<string, unknown>;

/**
 * Generic realtime table hook: initial fetch + a postgres_changes subscription
 * that refetches on any change. Refetch-on-change keeps the client mapping
 * trivial and is fine at this data scale. Degrades to [] if unconfigured.
 */
function useTable<T_>(
  table: string,
  map: (r: Row) => T_,
  opts: { order?: { col: string; asc: boolean }; limit?: number; filter?: { col: string; val: string } } = {},
  deps: unknown[] = []
): { data: T_[]; loading: boolean } {
  const [data, setData] = useState<T_[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = supabase();
    if (!db) {
      setLoading(false);
      return;
    }
    let active = true;

    const fetchAll = async () => {
      let q = db.from(table).select("*");
      if (opts.filter) q = q.eq(opts.filter.col, opts.filter.val);
      if (opts.order) q = q.order(opts.order.col, { ascending: opts.order.asc });
      if (opts.limit) q = q.limit(opts.limit);
      const { data: rows, error } = await q;
      if (!active) return;
      if (error) console.error(`fetch ${table} failed:`, error.message);
      setData(((rows ?? []) as Row[]).map(map));
      setLoading(false);
    };

    fetchAll();
    const channel = db
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, fetchAll)
      .subscribe();

    return () => {
      active = false;
      db.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}

export function useIssues() {
  return useTable<Issue>(T.issues, rowToIssue);
}

export function useAgentActivity(max = 50) {
  return useTable<AgentActivity>(T.activity, rowToActivity, { order: { col: "created_at", asc: false }, limit: max }, [max]);
}

export function useIssuesByWard(wardId: string) {
  return useTable<Issue>(T.issues, rowToIssue, { filter: { col: "ward_id", val: wardId } }, [wardId]);
}

export function useIssueActivity(issueId: string) {
  return useTable<AgentActivity>(T.activity, rowToActivity, { filter: { col: "issue_id", val: issueId } }, [issueId]);
}

export function useLeaderboard() {
  return useTable<UserProfile>(T.profiles, rowToProfile, { order: { col: "xp", asc: false }, limit: 5 });
}

/** Single issue, realtime. */
export function useIssue(issueId: string): { data: Issue | null; loading: boolean } {
  const [data, setData] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const db = supabase();
    if (!db || !issueId) {
      setLoading(false);
      return;
    }
    let active = true;
    const fetchOne = async () => {
      const { data: row } = await db.from(T.issues).select("*").eq("id", issueId).maybeSingle();
      if (!active) return;
      setData(row ? rowToIssue(row as Row) : null);
      setLoading(false);
    };
    fetchOne();
    const channel = db
      .channel(`rt-issue-${issueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: T.issues, filter: `id=eq.${issueId}` }, fetchOne)
      .subscribe();
    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [issueId]);
  return { data, loading };
}

export function useWard(wardId: string): { data: Ward | null; loading: boolean } {
  const [data, setData] = useState<Ward | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const db = supabase();
    if (!db || !wardId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data: r } = await db.from(T.wards).select("*").eq("ward_id", wardId).maybeSingle();
      if (!active) return;
      if (r) {
        setData({
          wardId,
          wardName: String(r.ward_name ?? wardId),
          totalReported: Number(r.total_reported ?? 0),
          totalResolved: Number(r.total_resolved ?? 0),
          totalPredicted: Number(r.total_predicted ?? 0),
          avgResolutionDays: Number(r.avg_resolution_days ?? 0),
          healthScore: Number(r.health_score ?? 0),
          lastUpdated: new Date(String(r.last_updated)).getTime() || 0,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [wardId]);
  return { data, loading };
}

export function useUserProfile(uid: string | undefined): { data: UserProfile | null; loading: boolean } {
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const db = supabase();
    if (!db || !uid) {
      setLoading(false);
      return;
    }
    let active = true;
    const fetchOne = async () => {
      const { data: r } = await db.from(T.profiles).select("*").eq("uid", uid).maybeSingle();
      if (!active) return;
      setData(r ? rowToProfile(r as Row) : null);
      setLoading(false);
    };
    fetchOne();
    const channel = db
      .channel(`rt-profile-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: T.profiles, filter: `uid=eq.${uid}` }, fetchOne)
      .subscribe();
    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [uid]);
  return { data, loading };
}

export function useCityMetrics(): { data: CityMetrics | null; loading: boolean } {
  const [data, setData] = useState<CityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const db = supabase();
    if (!db) {
      setLoading(false);
      return;
    }
    let active = true;
    const fetchOne = async () => {
      const { data: r } = await db.from(T.metrics).select("*").eq("id", "current").maybeSingle();
      if (!active) return;
      if (r) {
        setData({
          civicScore: Number(r.civic_score ?? 0),
          totalOpenIssues: Number(r.total_open_issues ?? 0),
          totalResolvedThisMonth: Number(r.total_resolved_this_month ?? 0),
          avgResolutionDays: Number(r.avg_resolution_days ?? 0),
          activeWardsCount: Number(r.active_wards_count ?? 0),
          weeklyDelta: Number(r.weekly_delta ?? 0),
          lastUpdated: new Date(String(r.last_updated)).getTime() || 0,
        });
      }
      setLoading(false);
    };
    fetchOne();
    const channel = db
      .channel("rt-metrics")
      .on("postgres_changes", { event: "*", schema: "public", table: T.metrics }, fetchOne)
      .subscribe();
    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, []);
  return { data, loading };
}
