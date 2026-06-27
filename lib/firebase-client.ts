/**
 * Firebase Web SDK — browser-side. Provides auth, firestore (for realtime
 * onSnapshot), storage and (optionally) messaging. Config comes from a single
 * NEXT_PUBLIC_FIREBASE_CONFIG JSON env var.
 */
"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function readConfig(): FirebaseClientConfig | null {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseClientConfig;
  } catch {
    console.error("NEXT_PUBLIC_FIREBASE_CONFIG is not valid JSON");
    return null;
  }
}

let _app: FirebaseApp | null = null;

export function clientApp(): FirebaseApp | null {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApp();
    return _app;
  }
  const config = readConfig();
  if (!config) return null;
  _app = initializeApp(config);
  return _app;
}

export function clientAuth(): Auth | null {
  const app = clientApp();
  return app ? getAuth(app) : null;
}

export function clientDb(): Firestore | null {
  const app = clientApp();
  return app ? getFirestore(app) : null;
}

export function clientStorage(): FirebaseStorage | null {
  const app = clientApp();
  return app ? getStorage(app) : null;
}

export const googleProvider = new GoogleAuthProvider();
