/**
 * ReplyComposer — Ceremonial single reply overlay.
 *
 * Hardened:
 * - AbortController for request cancellation
 * - Unmount safety guard
 * - Defensive response parsing
 * - Strict submission locking
 *
 * Animations fully preserved from original extraction.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

/* ── Helpers ── */

function getSessionKeyFromPath(): string | null {
  const cleaned = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!cleaned) return null;
  const parts = cleaned.split('-');
  const key = parts[parts.length - 1] || '';
  return /^[a-z0-9]{8}$/i.test(key) ? key.toLowerCase() : null;
}

/* ── Types ── */

interface ReplyComposerProps {
  senderName: string;
  theme: {
    bg: string;
    text: string;
    gold: string;
  };
  onClose: () => void;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  senderName,
  theme,
  onClose,
}) => {
  const [replyText, setReplyText] = useState('');
  const [replySealed, setReplySealed] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const handleSeal = useCallback(async () => {
    const trimmed = replyText.trim();
    if (!trimmed || replySending) return;

    setReplySending(true);
    setReplyError(null);

    const sessionKey = getSessionKeyFromPath();
    if (!sessionKey) {
      setReplyError('Reply is only available on a valid shared link.');
      setReplySending(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/save-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey, replyText: trimmed }),
        signal: controller.signal,
      });

      let responseBody: any = null;
      try {
        responseBody = await response.json();
      } catch {
        // Non-JSON response safe
      }

      if (!response.ok) {
        throw new Error(responseBody?.error || 'Failed to seal your reply.');
      }

      if (!mountedRef.current) return;

      setReplySealed(true);
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (err?.name === 'AbortError') return;

      setReplyError(err?.message || 'Failed to seal your reply.');
      setReplySending(false);
    }
  }, [replyText, replySending]);

  /* ── Sealed Confirmation Screen ── */
  if (replySealed) {
    return (
      <div
        className="fixed inset-0 z-[350] flex flex-col items-center justify-center select-none"
        style={{ backgroundColor: theme.bg, animation: 'exitIntentIn 0.6s ease-out both' }}
      >
        <p
          style={{
            fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
            color: theme.text,
            animation: 'closureReveal 1s ease-out 0.3s both',
          }}
        >
          Your words have been sealed.
        </p>

        <div
          className="h-px mx-auto my-8"
          style={{
            backgroundColor: theme.gold,
            opacity: 0.2,
            animation: 'closureLine 0.8s ease-out 1.2s both',
          }}
        />

        <p
          className="text-[10px] uppercase tracking-[0.3em] font-bold"
          style={{
            color: theme.gold,
            opacity: 0.6,
            animation: 'closureReveal 0.8s ease-out 2s both',
          }}
        >
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}
          {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </p>

        <button
          onClick={onClose}
          className="mt-12 text-[8px] uppercase tracking-[0.4em] text-white/55 hover:text-white/80 transition-colors"
          style={{ animation: 'closureReveal 0.8s ease-out 3s both' }}
        >
          Return
        </button>
      </div>
    );
  }

  /* ── Compose Screen ── */
  return (
    <div
      className="fixed inset-0 z-[350] flex flex-col items-center justify-center select-none px-6"
      style={{ backgroundColor: theme.bg, animation: 'exitIntentIn 0.5s ease-out both' }}
    >
      <p
        className="mb-2"
        style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontStyle: 'italic',
          fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
          color: theme.text,
          animation: 'closureReveal 0.8s ease-out 0.2s both',
        }}
      >
        Your reply to {senderName}
      </p>

      <p
        className="text-[9px] uppercase tracking-[0.3em] text-white/50 mb-8"
        style={{ animation: 'closureReveal 0.6s ease-out 0.6s both' }}
      >
        One message. Make it count.
      </p>

      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
        placeholder="Write what you feel..."
        maxLength={500}
        rows={6}
        className="w-full max-w-md bg-transparent rounded-none p-5 text-white/80 text-sm leading-relaxed resize-none focus:outline-none placeholder-white/15"
        style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontStyle: 'italic',
          animation: 'closureReveal 0.8s ease-out 0.8s both',
          borderColor: theme.gold + '33',
        }}
        autoFocus
      />

      <p
        className="mt-2 text-[8px] text-white/55 tracking-wide self-end max-w-md w-full text-right"
        style={{ animation: 'closureReveal 0.6s ease-out 1s both' }}
      >
        {replyText.length}/500
      </p>

      {replyError && (
        <p className="mt-3 w-full max-w-md text-[10px] text-[#ffb4b4] text-center tracking-wide">
          {replyError}
        </p>
      )}

      <div
        className="mt-8 flex flex-col items-center gap-4"
        style={{ animation: 'closureReveal 0.8s ease-out 1.2s both' }}
      >
        <button
          onClick={handleSeal}
          disabled={!replyText.trim() || replySending}
          className={`px-10 py-3 border transition-all duration-300 ${
            replyText.trim() && !replySending
              ? ''
              : 'border-white/10 text-white/20 cursor-not-allowed'
          }`}
          style={{
            fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
            letterSpacing: '0.1em',
            ...(replyText.trim() && !replySending
              ? {
                  borderColor: theme.gold + '80',
                  color: theme.text,
                }
              : {}),
          }}
        >
          {replySending ? 'Sealing...' : 'Seal this reply'}
        </button>

        <button
          onClick={onClose}
          className="text-[8px] uppercase tracking-[0.4em] text-white/55 hover:text-white/80 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
};