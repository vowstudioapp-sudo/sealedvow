import React from 'react';

// PR-48 Phase 4 — Begin New cloud-aware prompt modal.
//
// Fires when the user clicks "Begin again" from DraftResumeModal AND either
// local has meaningful content OR cloud has an ACTIVE draft. Per doctrine,
// the lifecycle change is explicit — the user chooses what to do with the
// current composition before starting a new one.
//
// Three buttons (LOCKED per Phase 4 implementation prompt — do not rename):
//   * Save & Start New      — save current composition to cloud, then pause
//                             that ACTIVE, then clear local. Zero-ACTIVE
//                             window during the transition is valid per
//                             the locked invariant.
//   * Discard & Start New   — if cloud has ACTIVE, discard it (transition
//                             to ABANDONED); then clear local. If no cloud
//                             ACTIVE, just clear local.
//   * Cancel                — no-op. Local and cloud both untouched.
//
// All three button labels are locked. The orchestration runs in App.tsx;
// this component is the pure presentational shell.

interface Props {
  isOpen: boolean;
  hasCloudActive: boolean;
  onSaveAndStartNew: () => void;
  onDiscardAndStartNew: () => void;
  onCancel: () => void;
}

export const BeginNewPromptModal: React.FC<Props> = ({
  isOpen,
  hasCloudActive,
  onSaveAndStartNew,
  onDiscardAndStartNew,
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
        <h2 className="lp-modal__title">Start a new letter?</h2>
        <p className="lp-modal__sub">
          Do you want to save this draft to your Dashboard before starting a
          new one?
        </p>
        {!hasCloudActive && (
          <p
            className="lp-modal__sub"
            style={{ opacity: 0.6, fontSize: '0.85em', marginTop: '-0.5rem' }}
          >
            Saving will create a new draft on your Dashboard.
          </p>
        )}

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
            onClick={onSaveAndStartNew}
            className="lp-modal__primary"
          >
            Save &amp; Start New
          </button>
          <button
            type="button"
            onClick={onDiscardAndStartNew}
            className="lp-modal__secondary"
          >
            Discard &amp; Start New
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
