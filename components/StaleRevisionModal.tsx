import React from 'react';

// PR-48 Phase 4 — Stale revision reconciliation modal.
//
// Surfaces when /api/drafts/save returns 409 STALE_REVISION (the cloud
// draft was modified — by another device, or by the same user in another
// tab — after our locally-known revision). Per doctrine, no silent
// overwrite is permitted; the user explicitly chooses.
//
// Three buttons (LOCKED per Phase 4 implementation prompt — do not rename):
//   * Reload Latest        — fetch /api/drafts/list, replace local from
//                            the cloud's current ACTIVE, update draftRecord.
//                            User accepts losing their local edits.
//   * Keep Local for Now   — preserve local, do NOT save, cloud unchanged.
//                            lastSaveError remains visible so the user can
//                            retry or resolve later.
//   * Cancel               — close modal only. Preserve both sides. No
//                            retry. Identical to "Keep Local" in net effect
//                            but framed as "I want to think about this."
//
// NO force-overwrite path. NO automatic retry. NO blind compare-and-set
// against currentRevision. The user makes the explicit choice.

interface Props {
  isOpen: boolean;
  currentRevision: number;
  onReloadLatest: () => void;
  onKeepLocalForNow: () => void;
  onCancel: () => void;
}

export const StaleRevisionModal: React.FC<Props> = ({
  isOpen,
  currentRevision,
  onReloadLatest,
  onKeepLocalForNow,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="lp-modal-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="lp-modal">
        <button
          className="lp-modal__close"
          onClick={onCancel}
          aria-label="Close"
        >
          ✕
        </button>
        <h2 className="lp-modal__title">Draft was updated elsewhere</h2>
        <p className="lp-modal__sub">
          Another device or tab updated this draft after your last save. Your
          local edits aren't on the cloud yet.
        </p>
        <p
          className="lp-modal__sub"
          style={{ opacity: 0.6, fontSize: '0.85em', marginTop: '-0.5rem' }}
        >
          Cloud revision: {currentRevision}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginTop: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={onReloadLatest}
            className="lp-modal__primary"
          >
            Reload Latest
          </button>
          <button
            type="button"
            onClick={onKeepLocalForNow}
            className="lp-modal__secondary"
          >
            Keep Local for Now
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="lp-modal__tertiary"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(242, 232, 213, 0.5)',
              fontSize: '0.85em',
              cursor: 'pointer',
              padding: '0.5rem',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
