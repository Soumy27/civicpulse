/**
 * Firebase Admin SDK — server-side only. Used by all API routes, the agent
 * tools, and the seed script. Initialized once per runtime (Next.js may
 * re-import this module across hot reloads, so we guard with getApps()).
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function buildApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys stored in env have literal "\n" — convert back to newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // Fail loudly during boot rather than mysteriously at query time.
    throw new Error(
      "Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    // Newer Firebase projects use <project>.firebasestorage.app; fall back to
    // the legacy appspot.com bucket for older projects.
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`,
  });
}

let _db: Firestore | null = null;

export function adminApp(): App {
  return buildApp();
}

export function db(): Firestore {
  if (_db) return _db;
  const firestore = getFirestore(buildApp());
  // Ignore undefined fields so partial writes don't throw. settings() may only
  // be called once per Firestore instance; in dev, HMR can re-evaluate this
  // module while the underlying instance persists, so guard against the
  // "already initialized" error.
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* settings already applied on this instance — safe to ignore */
  }
  _db = firestore;
  return _db;
}

export function bucket() {
  return getStorage(buildApp()).bucket();
}

// Re-export FieldValue/Timestamp for callers that need server values.
export { FieldValue, Timestamp } from "firebase-admin/firestore";
