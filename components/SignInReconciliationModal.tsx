import React from 'react';

// PR-48 Phase 4 — Sign-in Case B reconciliation modal.
//
// Fires when the user has just signed in AND both:
//   * the cloud has an ACTIVE draft for this user, AND
//   * the local working copy has meaningful unsaved content
// (Case A — cloud ACTIVE + empty local — silently hydrates per existing
// flow. Case C — no cloud ACTIVE + local content — stays silent; local
// remains authoritative until the user explicitly saves.)
//
// Three buttons (LOCKED per Phase 4 implementation prompt — do not rename):
//   * Continue Dashboard Draft  — discard local, hydrate from cloud ACTIVE.
//   * Save Local Draft as New   — pause cloud ACTIVE, create new ACTIVE
//                                 from local. Two-step orchestration.
//   * Discard Local Draft       — clear local, hydrate from cloud ACTIVE.
//
// Continue Dashboard Draft and Discard Local Draft are operationally
// convergent (both end up with local discarded + cloud as authority).
// Distinct labels preserved per locked spec — "Continue" frames cloud as
// the work the user wants to resume; "Discard" frames local as the work
// the user wants to throw away. Same outcome; different mental model.
//
// Orchestration runs in App.tsx; this component is the pure shell.

interface CloudDraftDisplayMetadata {
  recipientName?: string;
  draftState?: string;
  updatedAt?: number | null;
}

interface LocalDraftDisplayMetadata {
  recipientName?: string;
  wordCount?: number;
  photoCount?: number;
  savedAt?: string;
}

interface Props {
  isOpen: boolean;
  cloudDraft: CloudDraftDisplayMetadata;
  localMetadata: LocalDraftDisplayMetadata;
  onContinueDashboardDraft: () => void;
  onDiscardLocalDraft: () => void;
}

const formatRelative = (ms: number | null | undefined): string => {
  if (typeof ms !== 'number') return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
};

export const SignInReconciliationModal: React.FC<Props> = ({
  isOpen,
  cloudDraft,
  localMetadata,
  onContinueDashboardDraft,
  onDiscardLocalDraft,
}) => {
  if (!isOpen) return null;

  // Note: no Cancel button. Sign-in Case B is a forced reconciliation —
  // the user must choose one of the three resolutions. Closing without
  // resolving would leave the pendingAction queue blocked, defeating the
  // hydration-gating contract. Backdrop click is also disabled.

  return (
    <div
      className="lp-modal-backdrop open"
      // Intentionally no onClick handler — must resolve explicitly.
    >
      <div className="lp-modal">
        <h2 className="lp-modal__title">Continue where you left off?</h2>
        <p className="lp-modal__sub">
          You have an unsaved draft on this device and an active draft on your
          Dashboard.
        </p>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginTop: '1rem',
            fontSize: '0.85em',
            color: 'rgba(242, 232, 213, 0.7)',
          }}
        >
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Dashboard draft
          </div>
          <div style={{ opacity: 0.8 }}>
            {cloudDraft.recipientName
              ? `For ${cloudDraft.recipientName}`
              : 'Unnamed recipient'}
            {cloudDraft.updatedAt
              ? ` · last edited ${formatRelative(cloudDraft.updatedAt)}`
              : ''}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginTop: '0.75rem',
            fontSize: '0.85em',
            color: 'rgba(242, 232, 213, 0.7)',
          }}
        >
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Local draft (this device)
          </div>
          <div style={{ opacity: 0.8 }}>
            {localMetadata.recipientName
              ? `For ${localMetadata.recipientName}`
              : 'Unnamed recipient'}
            {typeof localMetadata.wordCount === 'number'
              ? ` · ${localMetadata.wordCount} words`
              : ''}
            {typeof localMetadata.photoCount === 'number' &&
            localMetadata.photoCount > 0
              ? ` · ${localMetadata.photoCount} photo${
                  localMetadata.photoCount === 1 ? '' : 's'
                }`
              : ''}
          </div>
        </div>

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
            onClick={onContinueDashboardDraft}
            className="lp-modal__primary"
          >
            Continue Dashboard Draft
          </button>
          <button
            type="button"
            onClick={onDiscardLocalDraft}
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
            Discard Local Draft
          </button>
        </div>
      </div>
    </div>
  );
};
