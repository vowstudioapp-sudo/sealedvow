// ============================================================================
// /services/firebase.ts — Firebase client SDK (auth only)
//
// Initializes a single Firebase app and exposes the Google sign-in flow.
// signInWithGoogle() performs the popup, then exchanges the resulting
// ID token for a server session cookie via /api/auth/session. If the
// server call fails, the client-side Firebase session is rolled back so
// local state never drifts from server truth.
// ============================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  // Force the Google account chooser on every sign-in attempt. Without
  // prompt=select_account, Google silently reuses the browser's active
  // session, which prevents users from switching accounts after sign-out
  // without clearing cookies. Provider-level config only — no change to
  // Firebase session persistence or the downstream /api/auth/session
  // exchange below.
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);
  const idToken = await user.getIdToken();

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    // Roll back the Firebase client session so UI doesn't show signed-in
    // when the server never issued a cookie.
    await fbSignOut(auth).catch(() => {});
    throw new Error('Session creation failed');
  }
  return user;
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {}); // network failure shouldn't block client sign-out
  await fbSignOut(auth);
}

export const onAuthStateChanged = fbOnAuthStateChanged;
