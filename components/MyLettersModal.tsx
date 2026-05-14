import React, { useEffect, useState } from 'react';

interface Letter {
  sessionKey: string;
  recipientName: string;
  occasion: string;
  createdAt: number | null;
  openedAt: number | null;
  repliedAt: number | null;
  status: 'sent' | 'opened' | 'replied';
}

// PR-49 C2 (Task 11 / LOCK-3): Drafts section data shape. Mirrors the
// GET /api/draft response (Phase B) projected onto the dashboard surface.
interface DraftSummary {
  draftId: string;
  recipientName: string;
  occasion: string;
  draftState: string;
  updatedAt: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
}

function formatDate(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// V1 occasion display labels. Unknown ids fall back to the raw string so
// historical letters with removed occasions (birthday/apology/thank-you)
// still render legibly without forcing a data migration.
const OCCASION_DISPLAY_LABELS: Record<string, string> = {
  'anniversary': 'Anniversary',
  'just-because': 'Unsaid',
  'eid': 'Eid',
};

function displayOccasion(occasion: string): string {
  return OCCASION_DISPLAY_LABELS[occasion] || occasion;
}

export const MyLettersModal: React.FC<Props> = ({ isOpen, onClose, onCreateNew }) => {
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // PR-49 C2 (Task 11 / LOCK-3): authenticated user's one cloud draft.
  // Fetched alongside letters; null = none, undefined = still loading.
  const [draft, setDraft] = useState<DraftSummary | null | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDraft(undefined);

    // Letters list (existing behavior — sent letters from shared/*).
    fetch('/api/letters/list', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (!cancelled) setLetters(data.letters || []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load letters.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Drafts: authenticated user's one cloud draft (Phase B endpoint).
    fetch('/api/draft', { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404 || res.status === 401) {
          setDraft(null);
          return;
        }
        if (!res.ok) {
          setDraft(null);
          return;
        }
        const json = await res.json() as {
          data?: { recipientName?: string; occasion?: string };
          draftState?: string;
          updatedAt?: number;
          draftId?: string;
        };
        if (cancelled) return;
        // Defensive: skip COMPLETED records — they aren't resumable drafts
        // (verify-payment.js sets draftState='COMPLETED' on payment success;
        // such records should not appear under "Drafts").
        if (json.draftState === 'COMPLETED' || !json.draftId) {
          setDraft(null);
          return;
        }
        setDraft({
          draftId: json.draftId,
          recipientName: json.data?.recipientName || '',
          occasion: json.data?.occasion || '',
          draftState: json.draftState || '',
          updatedAt: typeof json.updatedAt === 'number' ? json.updatedAt : null,
        });
      })
      .catch(() => {
        if (!cancelled) setDraft(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResumeDraft = () => {
    onClose();
    window.location.href = '/create';
  };

  return (
    <div
      className={`lp-modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lp-modal lp-modal--letters">
        <button className="lp-modal__close" onClick={onClose}>✕</button>
        <h2 className="lp-modal__title">My Letters</h2>
        <button
          className="lp-letters-create"
          onClick={() => {
            onClose();
            onCreateNew();
          }}
        >
          + Create
        </button>
        <div className="lp-modal__rule" />

        {/* PR-49 C2 (Task 11 / LOCK-3): Drafts section. Shown above Letters
            so the user's in-progress work is the first thing they see. */}
        <div style={{ marginBottom: 16 }}>
          <p
            className="lp-modal__sub"
            style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}
          >
            Drafts
          </p>
          {draft === undefined && (
            <p className="lp-modal__sub" style={{ fontSize: 11 }}>Loading…</p>
          )}
          {draft === null && (
            <p className="lp-modal__sub" style={{ fontSize: 11 }}>
              No saved drafts.
            </p>
          )}
          {draft && (
            <div className="lp-letter-item">
              <div className="lp-letter-item__main">
                <div className="lp-letter-item__row">
                  <span className="lp-letter-item__recipient">
                    {draft.recipientName || 'Untitled draft'}
                  </span>
                  {draft.occasion && (
                    <span className="lp-letter-item__occasion">{displayOccasion(draft.occasion)}</span>
                  )}
                </div>
                <div className="lp-letter-item__meta">
                  <span className="lp-letter-item__date">
                    {draft.updatedAt ? `Updated ${formatDate(draft.updatedAt)}` : 'In progress'}
                  </span>
                </div>
              </div>
              <button
                className="lp-letter-item__view"
                onClick={handleResumeDraft}
              >
                Resume
              </button>
            </div>
          )}
        </div>

        <div className="lp-modal__rule" />

        <p
          className="lp-modal__sub"
          style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, marginTop: 8 }}
        >
          Sent
        </p>

        {loading && <p className="lp-modal__sub">Loading…</p>}

        {error && (
          <p className="lp-modal__sub" style={{ color: '#e88' }}>{error}</p>
        )}

        {letters && letters.length === 0 && !loading && (
          <p className="lp-modal__sub">
            No letters yet. Your sent letters will appear here.
          </p>
        )}

        {letters && letters.length > 0 && (
          <div className="lp-letters-list">
            {letters.map((letter) => (
              <div key={letter.sessionKey} className="lp-letter-item">
                <div className="lp-letter-item__main">
                  <div className="lp-letter-item__row">
                    <span className="lp-letter-item__recipient">{letter.recipientName}</span>
                    <span className="lp-letter-item__occasion">{displayOccasion(letter.occasion)}</span>
                  </div>
                  <div className="lp-letter-item__meta">
                    <span className="lp-letter-item__date">{formatDate(letter.createdAt)}</span>
                    <span className={`lp-letter-status lp-letter-status--${letter.status}`}>
                      {letter.status}
                    </span>
                  </div>
                </div>
                <button
                  className="lp-letter-item__view"
                  onClick={() => {
                    window.location.href = `/${letter.sessionKey}`;
                  }}
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
