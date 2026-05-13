import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { setActiveMode, type ActiveMode } from '../utils/activeMode';

// PR-49 Phase A — Mode entry primitive (dormant).
//
// Fires when the signed-out user clicks "Create Your Letter" on the landing
// page. The chosen mode is written to sessionStorage by setActiveMode() and
// is binding for the entire draft lifetime per invariants I1, I2 in
// docs/proposals/dual-mode-persistence.md.
//
// Mandatory dismissal: no backdrop click, no Escape key, no close button.
// The user must explicitly choose one of the two options (per proposal §2.1
// and strategy §5.3 — single explicit write site).
//
// Bundle: this component ships in the landing-page bundle (NOT lazy-loaded).
// Per diagnostic §7.5 — sits on the critical entry interaction path.

interface Props {
  isOpen: boolean;
  onChosen: (mode: ActiveMode) => void;
  // Returns the Firebase User on successful sign-in, or null if the user
  // cancelled / sign-in errored. The caller is responsible for wrapping
  // their auth helper to coerce thrown errors into null returns.
  onSignIn: () => Promise<User | null>;
}

export const ModeSelectionModal: React.FC<Props> = ({
  isOpen,
  onChosen,
  onSignIn,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reset transient state when the modal closes between mounts.
  useEffect(() => {
    if (!isOpen) {
      setIsSigningIn(false);
      setSignInError(null);
    }
  }, [isOpen]);

  // Keyboard: focus the first button on open so Tab cycles between the two
  // mandatory choices. No Escape handling — the choice is binding.
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      firstButtonRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthenticated = async () => {
    if (isSigningIn) return;
    setSignInError(null);
    setIsSigningIn(true);
    try {
      const result = await onSignIn();
      if (result) {
        setActiveMode('authenticated');
        onChosen('authenticated');
      } else {
        // Sign-in cancelled or failed silently. Modal stays open; the user
        // can retry or pick Guest.
        setSignInError('Sign-in did not complete. Try again or continue as guest.');
      }
    } catch {
      // onSignIn contract is Promise<User | null>; throws are caller-side
      // contract violations. Render a generic message and stay open.
      setSignInError('Sign-in failed. Try again or continue as guest.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGuest = () => {
    if (isSigningIn) return;
    setActiveMode('guest');
    onChosen('guest');
  };

  return (
    <div
      className="lp-modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-selection-title"
      // No onClick — backdrop click does not dismiss. The choice is mandatory.
    >
      <div className="lp-modal">
        <h2 className="lp-modal__title" id="mode-selection-title">
          How would you like to create this letter?
        </h2>
        <div className="lp-modal__rule" />

        <button
          ref={firstButtonRef}
          className="lp-btn-google"
          disabled={isSigningIn}
          onClick={handleAuthenticated}
        >
          {isSigningIn ? 'Signing in…' : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>
        <p
          className="lp-modal__sub"
          style={{ marginTop: 10, marginBottom: 18, fontSize: 11, letterSpacing: '0.04em' }}
        >
          Save your progress to your account. Resume on any device. View your sent letters in your dashboard.
        </p>

        <button
          className="lp-btn-guest"
          disabled={isSigningIn}
          onClick={handleGuest}
        >
          Continue as Guest
        </button>
        <p
          className="lp-modal__sub"
          style={{ marginTop: 10, marginBottom: 0, fontSize: 11, letterSpacing: '0.04em' }}
        >
          Start writing right away, no account needed. Your draft stays on this device only.
        </p>

        {signInError && (
          <p
            role="alert"
            style={{ color: '#e88', fontSize: 12, marginTop: 14, textAlign: 'center' }}
          >
            {signInError}
          </p>
        )}
      </div>
    </div>
  );
};
