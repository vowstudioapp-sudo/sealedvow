// /hooks/draftStateLogic.ts — UIStage → DraftState lookup map.
// Consumed by App.tsx save handlers when computing the DraftState to record
// on the next save.

import { AppStage } from '../types';
import type { DraftState } from '../types/draft';

// SHARE is intentionally absent — the COMPLETED transition is owned by the
// server-side write inside api/verify-payment.js, not the client.
export const UI_STAGE_TO_DRAFT_STATE: Partial<Record<AppStage, DraftState>> = {
  [AppStage.PREPARE]: 'IN_PROGRESS',
  [AppStage.REFINE]: 'GENERATED',
  [AppStage.PERSONAL_INTRO]: 'REFINED',
  [AppStage.QUESTION]: 'REFINED',
  [AppStage.MAIN_EXPERIENCE]: 'PREVIEWED',
  [AppStage.PAYMENT]: 'READY_FOR_PAYMENT',
};

// PR-49 C2 (LOCK-1): inverse mapping for authenticated-mode hydration. Maps
// the server-persisted DraftState (returned by GET /api/draft) to the App
// stage the user should resume at.
//
//   'IN_PROGRESS'        → PREPARE
//   'GENERATED'          → REFINE
//   'REFINED'            → REFINE          (PERSONAL_INTRO + QUESTION both record
//                                            REFINED; resume lands the user at
//                                            the editable REFINE surface so they
//                                            can re-enter the canonical preview
//                                            chain on their own action)
//   'PREVIEWED'          → MAIN_EXPERIENCE
//   'READY_FOR_PAYMENT'  → PAYMENT
//
// COMPLETED is intentionally absent. Completed paid letters must NEVER be
// resumed as active drafts (business rule). Returning null signals "no
// recoverable draft" — the hydration falls through to the route default.
// Same null contract for unrecognized or null input.
export function appStageFromDraftState(
  state: DraftState | null | undefined,
): AppStage | null {
  switch (state) {
    case 'IN_PROGRESS':
      return AppStage.PREPARE;
    case 'GENERATED':
      return AppStage.REFINE;
    case 'REFINED':
      return AppStage.REFINE;
    case 'PREVIEWED':
      return AppStage.MAIN_EXPERIENCE;
    case 'READY_FOR_PAYMENT':
      return AppStage.PAYMENT;
    case 'COMPLETED':
    default:
      return null;
  }
}
