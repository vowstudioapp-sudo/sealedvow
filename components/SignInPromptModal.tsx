import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onContinueAsGuest: () => void;
  onSignInSuccess: () => void;
}

export const SignInPromptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onContinueAsGuest,
  onSignInSuccess,
}) => {
  const { signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setSignInError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      // Session cookie is set by the time signInWithGoogle() resolves,
      // so downstream API calls (create-order, verify-payment) will see it.
      onSignInSuccess();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // user-initiated cancel — stay silent, let them try again or pick guest
      } else if (code === 'auth/popup-blocked') {
        setSignInError('Popup was blocked. Please allow popups and try again.');
      } else {
        setSignInError('Sign-in failed. Please try again.');
      }
      console.error('SignInPromptModal sign-in failed:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div
      className="lp-modal-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lp-modal">
        <button className="lp-modal__close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="lp-modal__title">Save your letter</h2>
        <p className="lp-modal__sub">
          Sign in to keep your letter, track when it's opened, and view replies.
        </p>
        <div className="lp-modal__rule" />

        <button
          className="lp-btn-google"
          disabled={isSigningIn}
          onClick={handleGoogle}
        >
          {isSigningIn ? 'Signing in…' : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {signInError && (
          <p role="alert" style={{ color: '#e88', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            {signInError}
          </p>
        )}

        <button className="lp-btn-guest" onClick={onContinueAsGuest}>
          Continue as Guest
        </button>
      </div>
    </div>
  );
};
