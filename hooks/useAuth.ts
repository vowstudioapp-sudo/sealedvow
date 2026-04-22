// ============================================================================
// /hooks/useAuth.ts — Auth state hook
//
// Subscribes to Firebase auth state changes and exposes sign-in / sign-out
// helpers. Note: client auth state is for UI only. Backend must re-verify
// the session cookie on every protected request via getSessionUser().
// ============================================================================

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { auth, onAuthStateChanged, signInWithGoogle, signOut } from '../services/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading, signInWithGoogle, signOut };
}
