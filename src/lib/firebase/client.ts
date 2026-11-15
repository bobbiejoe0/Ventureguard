"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let app: FirebaseApp | null = null;
let appCheck: AppCheck | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured. Copy .env.example to .env.local and fill in your project values.");
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  initAppCheck(app);
  return app;
}

/**
 * App Check protects Firebase AI Logic from abuse.
 * Local dev: set NEXT_PUBLIC_APPCHECK_DEBUG=true, then register the debug token
 * printed in the browser console under App Check → Manage debug tokens.
 */
function initAppCheck(a: FirebaseApp) {
  if (appCheck || typeof window === "undefined") return;
  const debug = process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "true";
  // In debug mode the provider is never called, so a placeholder key is fine until reCAPTCHA is registered.
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || (debug ? "debug-placeholder" : "");
  if (debug) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  if (!siteKey) {
    console.warn("[VentureGuard] App Check site key missing: NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
    return;
  }
  const provider =
    process.env.NEXT_PUBLIC_RECAPTCHA_PROVIDER === "v3" ? new ReCaptchaV3Provider(siteKey) : new ReCaptchaEnterpriseProvider(siteKey);
  appCheck = initializeAppCheck(a, { provider, isTokenAutoRefreshEnabled: true });
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Firestore with persistent IndexedDB cache: reads work offline, writes queue and sync on reconnect. */
export function getDb(): Firestore {
  if (db) return db;
  const a = getFirebaseApp();
  try {
    db = initializeFirestore(a, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = getFirestore(a);
  }
  return db;
}
