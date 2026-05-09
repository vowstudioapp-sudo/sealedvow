// ============================================================================
// /hooks/draftStateLogic.ts — Pure observer logic (PR #18a)
//
// All non-React logic for the draft-state observer lives here so it's
// testable without a test framework. The React wrapper hook (next file over)
// imports `decideTransition` and is responsible only for lifecycle, the
// optimistic-rollback fetch, and the request-token guard.
//
// CRITICAL: this is a lookup, not a mapping. The observer first computes the
// candidate target state from UIStage, then applies the monotonic check
// against the last persisted state before producing a `write` decision.
// PERSONAL_INTRO and QUESTION both map to REFINED — the milestone-boundary
// check ensures cinematic micro-transitions between them never write.
// ============================================================================

import { AppStage } from '../types';
import type { DraftState } from '../types/draft';
import { DRAFT_STATE_ORDER } from '../types/draft';

// SHARE is intentionally absent — the COMPLETED transition is owned by the
// server-side write inside api/verify-payment.js, not the client observer.
export const UI_STAGE_TO_DRAFT_STATE: Partial<Record<AppStage, DraftState>> = {
  [AppStage.PREPARE]: 'IN_PROGRESS',
  [AppStage.REFINE]: 'GENERATED',
  [AppStage.PERSONAL_INTRO]: 'REFINED',
  [AppStage.QUESTION]: 'REFINED',
  [AppStage.MAIN_EXPERIENCE]: 'PREVIEWED',
  [AppStage.PAYMENT]: 'READY_FOR_PAYMENT',
};

export type TransitionDecision =
  | { kind: 'write'; candidate: DraftState }
  | { kind: 'noop'; reason: 'no_candidate' | 'not_monotonic' | 'same_state' };

/**
 * Pure decision: given the current UIStage and the last successfully
 * persisted DraftState, should the observer fire a write?
 *
 * @param uiStage Current AppStage value from App.tsx state.
 * @param lastPersistedDraftState Last DraftState confirmed persisted by the
 *   server (or null if no successful write has occurred yet).
 *
 * Returns:
 *   { kind: 'write', candidate }   — fire transition to `candidate`
 *   { kind: 'noop', reason }       — do not write; reason for diagnostics
 */
export function decideTransition(
  uiStage: AppStage,
  lastPersistedDraftState: DraftState | null,
): TransitionDecision {
  const candidate = UI_STAGE_TO_DRAFT_STATE[uiStage];
  if (!candidate) {
    return { kind: 'noop', reason: 'no_candidate' };
  }
  const lastIndex = lastPersistedDraftState !== null
    ? DRAFT_STATE_ORDER[lastPersistedDraftState]
    : -1;
  const candidateIndex = DRAFT_STATE_ORDER[candidate];

  if (candidateIndex < lastIndex) {
    return { kind: 'noop', reason: 'not_monotonic' };
  }
  if (candidateIndex === lastIndex) {
    return { kind: 'noop', reason: 'same_state' };
  }
  return { kind: 'write', candidate };
}
