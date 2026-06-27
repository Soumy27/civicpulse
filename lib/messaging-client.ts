"use client";

/**
 * FCM client registration. Requests notification permission, registers the
 * service worker (passing the web config via query params so the SW can
 * init Firebase), retrieves a token, and saves it to the user's profile so
 * the agent can push to them. All failures are non-fatal.
 */
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { clientApp, clientDb } from "./firebase-client";

export async function registerForPush(uid: string): Promise<string | null> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
    const app = clientApp();
    if (!app) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const cfg = app.options as Record<string, string>;
    const qs = new URLSearchParams({
      apiKey: cfg.apiKey ?? "",
      authDomain: cfg.authDomain ?? "",
      projectId: cfg.projectId ?? "",
      messagingSenderId: cfg.messagingSenderId ?? "",
      appId: cfg.appId ?? "",
    }).toString();

    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${qs}`
    );

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      const db = clientDb();
      if (db) await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
    }

    // Foreground messages: surface as a simple browser notification.
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification ?? {};
      if (title) new Notification(title, { body });
    });

    return token ?? null;
  } catch (err) {
    console.error("registerForPush failed:", err);
    return null;
  }
}
