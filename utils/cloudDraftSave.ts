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
// PR-49 C2 hotfix (LOCK-3): CAS plumbing retired. expectedRevision removed
// from the input type. Last-write-wins is the locked dual-mode behavior —
// there is no concurrent-edit scenario under single-writer-per-mode (I7).
//
// OQ3 contract: callers handle 'auth_required' by hard-redirecting to "/".
// ============================================================================

import type { CoupleData } from '../types';
import type { DraftState } from '../types/draft';
import { saveDraft, type SaveDraftInput } from './saveDraft';

export interface CloudSaveInput {
  data: Partial<CoupleData> | CoupleData;
  draftState: DraftState;
  // null on first save (server assigns a new draftId via .push().key);
  // populated on subsequent saves so the server UPDATEs the same record
  // rather than refusing with ACTIVE_DRAFT_EXISTS.
  draftId: string | null;
  // PR-49 Phase 1: sub-step within PREPARE (1 | 2 | 3). Persisted so that
  // authenticated refresh restores the exact step the user was on, not
  // just the broad PREPARE stage. Omitted from non-PREPARE stages.
  step?: 1 | 2 | 3;
}

export type CloudSaveResult =
  | { kind: 'ok'; draftId: string; updatedAt: number | null }
  | { kind: 'auth_required' }
  | { kind: 'error'; message: string };

export async function saveAndContinue(input: CloudSaveInput): Promise<CloudSaveResult> {
  const payload: SaveDraftInput = {
    data: input.data,
    draftState: input.draftState,
  };
  if (input.draftId) payload.draftId = input.draftId;
  if (input.step) payload.step = input.step;

  const result = await saveDraft(payload);

  switch (result.kind) {
    case 'ok':
      return { kind: 'ok', draftId: result.draftId, updatedAt: result.updatedAt };
    case 'unauthorized':
      return { kind: 'auth_required' };
    case 'network_error':
      return { kind: 'error', message: "Couldn't save just now. Check your connection." };
    case 'rate_limited':
      return { kind: 'error', message: 'Too many save attempts. Try again in a moment.' };
    default:
      return { kind: 'error', message: "Couldn't save just now. Your work is still here." };
  }
}
