import React, { useState } from 'react';

// PR-49 C2 (Task 3 / LOCK-2): authenticated-mode resume-or-discard prompt.
//
// Shown to a signed-in user clicking "Create Your Letter" when GET /api/draft
// returns an existing non-COMPLETED draft. Two phases:
//
//   Phase 1 — Continue / Discard prompt:
//     - "Continue your draft" → onContinue() (caller navigates to /create)
//     - "Discard and start new" → advance to phase 2
//
//   Phase 2 — Confirmation:
//     - "Yes, discard" → calls onConfirmDiscard (caller hits DELETE /api/draft,
//       then navigates to /create on success)
//     - "Cancel" → return to phase 1
//
// Mandatory dismissal: no close button, no backdrop dismissal. The user must
// pick one of the listed actions. Matches the ModeSelectionModal pattern
// from Phase A (proposal §2.1 — binding choices).

interface Props {
  isOpen: boolean;
  // Called when the user picks "Continue your draft". Caller is responsible
  // for navigating to /create (C1 hydration + Task 2 stage restoration takes
  // over from there).
  onContinue: () => void;
  // Called when the user confirms discard in phase 2. Caller is responsible
  // for issuing DELETE /api/draft and navigating to /create on success.
  // Returns a Promise so the modal can keep the destructive button disabled
  // while the network request is in flight.
  onConfirmDiscard: () => Promise<void>;
}

export const ResumeOrDiscardModal: React.FC<Props> = ({
  isOpen,
  onContinue,
  onConfirmDiscard,
}) => {
  const [phase, setPhase] = useState<'choice' | 'confirm'>('choice');
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  // Reset transient state when modal reopens (parent unmounts/remounts).
  React.useEffect(() => {
    if (!isOpen) {
      setPhase('choice');
      setIsDiscarding(false);
      setDiscardError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDiscardClick = () => setPhase('confirm');

  const handleConfirmYes = async () => {
    if (isDiscarding) return;
    setIsDiscarding(true);
    setDiscardError(null);
    try {
      await onConfirmDiscard();
    } catch {
      setDiscardError("Couldn't discard the draft. Try again in a moment.");
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleConfirmCancel = () => setPhase('choice');

  return (
    <div
      className="lp-modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-or-discard-title"
    >
      <div className="lp-modal">
        {phase === 'choice' ? (
          <>
            <h2 className="lp-modal__title" id="resume-or-discard-title">
              You have a saved draft.
            </h2>
            <div className="lp-modal__rule" />

            <button className="lp-btn-google" onClick={onContinue}>
              Continue your draft
            </button>
            <p
              className="lp-modal__sub"
              style={{ marginTop: 10, marginBottom: 18, fontSize: 11, letterSpacing: '0.04em' }}
            >
              Pick up where you left off.
            </p>

            <button className="lp-btn-guest" onClick={handleDiscardClick}>
              Discard and start new
            </button>
            <p
              className="lp-modal__sub"
              style={{ marginTop: 10, marginBottom: 0, fontSize: 11, letterSpacing: '0.04em' }}
            >
              Begin a fresh letter. Your saved draft will be permanently lost.
            </p>
          </>
        ) : (
          <>
            <h2 className="lp-modal__title" id="resume-or-discard-title">
              Are you sure?
            </h2>
            <div className="lp-modal__rule" />

            <p
              className="lp-modal__sub"
              style={{ marginTop: 0, marginBottom: 18, fontSize: 13, letterSpacing: '0.02em' }}
            >
              Your saved draft will be permanently lost. This cannot be undone.
            </p>

            <button
              className="lp-btn-google"
              disabled={isDiscarding}
              onClick={handleConfirmYes}
              style={{ background: '#722F37', color: '#fff' }}
            >
              {isDiscarding ? 'Discarding…' : 'Yes, discard'}
            </button>

            <button
              className="lp-btn-guest"
              disabled={isDiscarding}
              onClick={handleConfirmCancel}
              style={{ marginTop: 12 }}
            >
              Cancel
            </button>

            {discardError && (
              <p
                role="alert"
                style={{ color: '#e88', fontSize: 12, marginTop: 14, textAlign: 'center' }}
              >
                {discardError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
