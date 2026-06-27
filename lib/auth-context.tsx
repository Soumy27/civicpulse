"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";

export interface AppUser {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string | null;
  isAnonymous: boolean;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  /** Magic-link sign-in. Returns true if the email was sent. */
  signInEmail: (email: string) => Promise<boolean>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Returns the current access token for authenticated API calls. */
  getToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  signInEmail: async () => false,
  signInGuest: async () => {},
  signOut: async () => {},
  getToken: async () => null,
});

function toUser(session: Session | null): AppUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  return {
    uid: u.id,
    displayName: meta.display_name ?? meta.full_name ?? (u.is_anonymous ? "Guest Citizen" : u.email ?? "Citizen"),
    photoURL: meta.avatar_url ?? "",
    email: u.email ?? null,
    isAnonymous: Boolean(u.is_anonymous),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = supabase();
    if (!db) {
      setLoading(false);
      return;
    }
    db.auth.getSession().then(({ data }) => {
      setUser(toUser(data.session));
      setLoading(false);
    });
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => setUser(toUser(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInEmail = async (email: string) => {
    const db = supabase();
    if (!db) return false;
    const { error } = await db.auth.signInWithOtp({ email });
    if (error) {
      console.error("email sign-in failed:", error.message);
      return false;
    }
    return true;
  };

  const signInGuest = async () => {
    const db = supabase();
    if (!db) return;
    const { error } = await db.auth.signInAnonymously();
    if (error) console.error("anonymous sign-in failed:", error.message);
  };

  const signOut = async () => {
    await supabase()?.auth.signOut();
  };

  const getToken = async () => {
    const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  };

  return (
    <Ctx.Provider value={{ user, loading, signInEmail, signInGuest, signOut, getToken }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}
