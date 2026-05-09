// ============================================================================
// /hooks/useAuth.ts — Auth state hook
//
// Subscribes to Firebase auth state changes and exposes sign-in / sign-out
// helpers. Note: client auth state is for UI only. Backend must re-verify
// the session cookie on every protected request via getSessionUser().
//
// PR #18b — `serverSessionReady` deterministic signal.
//
// Background: Firebase's onAuthStateChanged fires as soon as signInWithPopup
// resolves (the client SDK has the user object). But our backend session
// cookie is minted by a SEPARATE call to /api/auth/session that runs INSIDE
// services/firebase.ts's signInWithGoogle wrapper. Between those two events
// — measured at hundreds of ms in incognito + slow networks — `user` is
// truthy but the cookie isn't in the browser's jar yet. Any authenticated
// fetch fired in that window goes out without a Cookie header and 401s.
//
// `serverSessionReady` flips true ONLY when one of these is observably
// confirmed:
//   1. A fresh signInWithGoogle call has completed end-to-end (the wrapped
//      version awaits services/firebase's signInWithGoogle, which itself
//      awaits the /api/auth/session POST).
//   2. Firebase rehydrates a previously signed-in user on page load
//      (signInInFlightRef === false at the time onAuthStateChanged fires);
//      the cookie was set on a prior visit and persists across reloads.
//      If the cookie has expired, downstream fetches will 401 and consumers
//      handle that as their own degraded path — but we still consider the
//      session "ready to attempt" because there's nothing more we can do
//      to establish freshness without an explicit re-sign-in.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle as fbSignInWithGoogle,
  signOut as fbSignOut,
} from '../services/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverSessionReady, setServerSessionReady] = useState(false);

  // Tracks whether a fresh signInWithGoogle is currently in flight, so the
  // mid-sign-in onAuthStateChanged fire (which precedes /api/auth/session
  // completion) does NOT optimistically flip serverSessionReady true.
  const signInInFlightRef = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setServerSessionReady(false);
        return;
      }
      // Rehydrated session path: not in the middle of a fresh sign-in →
      // Firebase restored the user from local storage. Assume the cookie
      // set on the previous visit is still in the jar. If it's expired,
      // downstream 401s will surface in the consumer.
      if (!signInInFlightRef.current) {
        setServerSessionReady(true);
      }
      // Else: fresh sign-in in flight. The wrapped signInWithGoogle below
      // will flip serverSessionReady true after /api/auth/session resolves.
    });
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    signInInFlightRef.current = true;
    setServerSessionReady(false);
    try {
      const result = await fbSignInWithGoogle();
      // services/firebase.ts's signInWithGoogle awaits POST /api/auth/session
      // and only resolves after the response (and Set-Cookie) lands. The
      // browser jar has the cookie by the time we get here.
      setServerSessionReady(true);
      return result;
    } finally {
      signInInFlightRef.current = false;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setServerSessionReady(false);
    await fbSignOut();
  }, []);

  return { user, loading, serverSessionReady, signInWithGoogle, signOut };
}
