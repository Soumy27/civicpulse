"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { clientDb } from "./firebase-client";
import { serializeIssue, serializeActivity } from "./serialize-client";
import type { AgentActivity, CityMetrics, Issue, UserProfile, Ward } from "./types";

/**
 * Generic realtime collection subscription. Returns docs + a loading flag.
 * Falls back to an empty array (and logs) if Firestore isn't configured so
 * the UI never crashes during the demo.
 */
function useCollection<T>(
  path: string,
  mapDoc: (id: string, data: Record<string, unknown>) => T,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = []
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = clientDb();
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>)));
        setLoading(false);
      },
      (err) => {
        console.error(`onSnapshot(${path}) failed:`, err);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}

export function useIssues(): { data: Issue[]; loading: boolean } {
  return useCollection<Issue>("issues", serializeIssue, [], []);
}

export function useAgentActivity(max = 50): { data: AgentActivity[]; loading: boolean } {
  return useCollection<AgentActivity>(
    "agentActivity",
    serializeActivity,
    [orderBy("timestamp", "desc"), fbLimit(max)],
    [max]
  );
}

export function useIssuesByWard(wardId: string): { data: Issue[]; loading: boolean } {
  return useCollection<Issue>("issues", serializeIssue, [where("wardId", "==", wardId)], [wardId]);
}

/** Subscribe to a single issue document. */
export function useIssue(issueId: string): { data: Issue | null; loading: boolean } {
  const [data, setData] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = clientDb();
    if (!db || !issueId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "issues", issueId),
      (snap) => {
        setData(snap.exists() ? serializeIssue(snap.id, snap.data() as Record<string, unknown>) : null);
        setLoading(false);
      },
      (err) => {
        console.error("issue snapshot failed:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [issueId]);

  return { data, loading };
}

/** Agent activity entries for one issue (its decision history). */
export function useIssueActivity(issueId: string): { data: AgentActivity[]; loading: boolean } {
  return useCollection<AgentActivity>(
    "agentActivity",
    serializeActivity,
    [where("issueId", "==", issueId)],
    [issueId]
  );
}

/** Subscribe to a single ward document. */
export function useWard(wardId: string): { data: Ward | null; loading: boolean } {
  const [data, setData] = useState<Ward | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const db = clientDb();
    if (!db || !wardId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "wards", wardId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setData({
            wardId,
            wardName: String(d.wardName ?? wardId),
            totalReported: Number(d.totalReported ?? 0),
            totalResolved: Number(d.totalResolved ?? 0),
            totalPredicted: Number(d.totalPredicted ?? 0),
            avgResolutionDays: Number(d.avgResolutionDays ?? 0),
            healthScore: Number(d.healthScore ?? 0),
            lastUpdated: Number(d.lastUpdated ?? 0),
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("ward snapshot failed:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [wardId]);
  return { data, loading };
}

/** Top users by XP, for the ward leaderboard. */
export function useLeaderboard(): { data: UserProfile[]; loading: boolean } {
  return useCollection<UserProfile>(
    "users",
    (id, d) => ({
      uid: id,
      displayName: String(d.displayName ?? "Citizen"),
      photoURL: String(d.photoURL ?? ""),
      xp: Number(d.xp ?? 0),
      badge: (d.badge as UserProfile["badge"]) ?? "newcomer",
      wardId: String(d.wardId ?? ""),
      reportedIssueIds: Array.isArray(d.reportedIssueIds) ? (d.reportedIssueIds as string[]) : [],
      verifiedIssueIds: Array.isArray(d.verifiedIssueIds) ? (d.verifiedIssueIds as string[]) : [],
      fcmToken: String(d.fcmToken ?? ""),
    }),
    [orderBy("xp", "desc"), fbLimit(5)],
    []
  );
}

/** A single user's profile document. */
export function useUserProfile(uid: string | undefined): { data: UserProfile | null; loading: boolean } {
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const db = clientDb();
    if (!db || !uid) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setData({
          uid,
          displayName: String(d.displayName ?? "Citizen"),
          photoURL: String(d.photoURL ?? ""),
          xp: Number(d.xp ?? 0),
          badge: (d.badge as UserProfile["badge"]) ?? "newcomer",
          wardId: String(d.wardId ?? ""),
          reportedIssueIds: Array.isArray(d.reportedIssueIds) ? (d.reportedIssueIds as string[]) : [],
          verifiedIssueIds: Array.isArray(d.verifiedIssueIds) ? (d.verifiedIssueIds as string[]) : [],
          fcmToken: String(d.fcmToken ?? ""),
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);
  return { data, loading };
}

/** Subscribe to the single cityMetrics/current document. */
export function useCityMetrics(): { data: CityMetrics | null; loading: boolean } {
  const [data, setData] = useState<CityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = clientDb();
    if (!db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "cityMetrics", "current"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setData({
            civicScore: Number(d.civicScore ?? 0),
            totalOpenIssues: Number(d.totalOpenIssues ?? 0),
            totalResolvedThisMonth: Number(d.totalResolvedThisMonth ?? 0),
            avgResolutionDays: Number(d.avgResolutionDays ?? 0),
            activeWardsCount: Number(d.activeWardsCount ?? 0),
            weeklyDelta: Number(d.weeklyDelta ?? 0),
            lastUpdated: Number(d.lastUpdated ?? 0),
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("cityMetrics snapshot failed:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { data, loading };
}
