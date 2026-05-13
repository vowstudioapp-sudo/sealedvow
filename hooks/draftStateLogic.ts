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
