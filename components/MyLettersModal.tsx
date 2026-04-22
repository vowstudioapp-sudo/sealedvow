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

export const MyLettersModal: React.FC<Props> = ({ isOpen, onClose, onCreateNew }) => {
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
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
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
          + Create New
        </button>
        <div className="lp-modal__rule" />

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
                    <span className="lp-letter-item__occasion">{letter.occasion}</span>
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
