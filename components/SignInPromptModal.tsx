import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

// PR #18b — variant prop. 'payment' is the existing behavior (byte-identical
// copy + Continue as Guest visible). 'persistence' switches the subtitle to
// the cross-device save framing AND hides the Guest button: Path A forbids
// guest-owned cloud drafts, so persistence demands sign-in or nothing.
type SignInPromptVariant = 'payment' | 'persistence';

const PERSISTENCE_SUBTITLE =
  'Sign in to save your letter and pick it back up on any device.';
const PAYMENT_SUBTITLE =
  "Sign in to keep your letter, track when it's opened, and view replies.";

const DELIVERY_EMAIL_LABEL =
  "Optional — if you continue as guest, we'll send your share link here. No account is created.";

const DELIVERY_EMAIL_PLACEHOLDER = 'your@email.com';

function isValidEmailShape(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onContinueAsGuest?: (guestEmail?: string) => void;
  onSignInSuccess: () => void;
  variant?: SignInPromptVariant;
}

export const SignInPromptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onContinueAsGuest,
  onSignInSuccess,
  variant = 'payment',
}) => {
  const { signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [deliveryEmail, setDeliveryEmail] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setDeliveryEmail('');
      setSignInError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedDelivery = deliveryEmail.trim();
  const deliveryLooksInvalid =
    trimmedDelivery.length > 0 && !isValidEmailShape(trimmedDelivery);

  const handleGoogle = async () => {
    setSignInError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      onSignInSuccess();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
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
          {variant === 'persistence' ? PERSISTENCE_SUBTITLE : PAYMENT_SUBTITLE}
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

        {variant === 'payment' && (
          <>
            <p
              className="lp-modal__sub"
              style={{ marginBottom: 12, marginTop: 16, fontSize: 10, letterSpacing: '0.08em' }}
            >
              {DELIVERY_EMAIL_LABEL}
            </p>
            <input
              className="lp-modal__input"
              type="email"
              name="delivery-email"
              autoComplete="email"
              placeholder={DELIVERY_EMAIL_PLACEHOLDER}
              value={deliveryEmail}
              onChange={(e) => { setDeliveryEmail(e.target.value); }}
              style={
                deliveryLooksInvalid
                  ? { borderColor: 'rgba(232, 136, 136, 0.55)' }
                  : undefined
              }
            />
          </>
        )}

        {variant === 'payment' && onContinueAsGuest && (
          <button
            className="lp-btn-guest"
            onClick={() => onContinueAsGuest(trimmedDelivery)}
          >
            Continue as Guest
          </button>
        )}
      </div>
    </div>
  );
};
