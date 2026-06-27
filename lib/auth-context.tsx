"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { clientAuth, clientDb } from "./firebase-client";
import { badgeForXp } from "./xp";

interface AuthState {
  user: User | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  signInGoogle: async () => {},
  signInGuest: async () => {},
  signOut: async () => {},
});

async function ensureUserDoc(user: User): Promise<void> {
  const db = clientDb();
  if (!db) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName ?? "Guest Citizen",
      photoURL: user.photoURL ?? "",
      xp: 0,
      badge: badgeForXp(0),
      wardId: "",
      reportedIssueIds: [],
      verifiedIssueIds: [],
      fcmToken: "",
    });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = clientAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await ensureUserDoc(u).catch((e) => console.error(e));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInGoogle = async () => {
    const auth = clientAuth();
    if (!auth) return;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("Google sign-in failed:", err);
    }
  };

  const signInGuest = async () => {
    const auth = clientAuth();
    if (!auth) return;
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error("Anonymous sign-in failed:", err);
    }
  };

  const signOut = async () => {
    const auth = clientAuth();
    if (!auth) return;
    await fbSignOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, loading, signInGoogle, signInGuest, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}
