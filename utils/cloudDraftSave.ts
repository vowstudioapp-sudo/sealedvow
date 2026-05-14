// ============================================================================
// utils/cloudDraftSave.ts — PR-49 authenticated-mode cloud save helper.
//
// Authenticated-mode-only. NO mode parameter. NO branching on mode. The
// existence of this file alongside hooks/usePreparationPersistence.ts (the
// guest authority) is intentional separation per proposal §8 anti-patterns
// (A8, A9, A12). A reviewer reading the import surface of this file should
// see ONLY authenticated-mode primitives; a reviewer reading the persistence
// hook should see ONLY localStorage primitives. There is no shared abstraction.
//
// This helper wraps saveDraft from utils/saveDraft.ts (which itself wraps
// POST /api/drafts/save). The result type is narrowed to a simple
// ok/error union — Phase D will narrow utils/saveDraft.ts to match.
//
// OQ3 contract: callers handle 'unauthorized' by hard-redirecting to "/".
// This helper surfaces 'error' for the 401 case; the caller branches.
// ============================================================================

import type { CoupleData } from '../types';
import type { DraftState } from '../types/draft';
import { saveDraft, type SaveDraftInput } from './saveDraft';

export interface CloudSaveInput {
  data: Partial<CoupleData> | CoupleData;
  draftState: DraftState;
  draftId?: string;
  expectedRevision?: number;
}

export type CloudSaveResult =
  | { kind: 'ok'; draftId: string; updatedAt: number | null }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

export async function saveAndContinue(input: CloudSaveInput): Promise<CloudSaveResult> {
  const payload: SaveDraftInput = {
    data: input.data,
    draftState: input.draftState,
  };
  if (input.draftId) payload.draftId = input.draftId;
  if (typeof input.expectedRevision === 'number') {
    payload.expectedRevision = input.expectedRevision;
  }

  const result = await saveDraft(payload);

  switch (result.kind) {
    case 'ok':
      return { kind: 'ok', draftId: result.draftId, updatedAt: result.updatedAt };
    case 'unauthorized':
      return { kind: 'unauthorized' };
    case 'network_error':
      return { kind: 'error', message: "Couldn't save just now. Check your connection." };
    case 'rate_limited':
      return { kind: 'error', message: 'Too many save attempts. Try again in a moment.' };
    default:
      return { kind: 'error', message: "Couldn't save just now. Your work is still here." };
  }
}
