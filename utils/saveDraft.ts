// ============================================================================
// utils/saveDraft.ts — Canonical save-draft helper (PR-48 Phase 4)
//
// Pure typed-result helper around POST /api/drafts/save. No React state. No
// localStorage writes. No side-effect orchestration. Callers handle revision
// tracking, local state, UX, and recovery.
//
// Returns a discriminated union covering every Phase 3 server error code
// plus network failure. The shape of `kind: 'ok'` mirrors the server's
// 200 response.
// ============================================================================

import type { CoupleData } from '../types';
import type { DraftState } from '../types/draft';

export interface SaveDraftInput {
  data: Partial<CoupleData> | CoupleData;
  step?: 1 | 2 | 3;
  draftState: DraftState;
  // Present → UPDATE existing draft (expectedRevision required).
  // Absent → CREATE new draft (expectedRevision ignored).
  draftId?: string;
  expectedRevision?: number;
}

export type SaveDraftResult =
  | {
      kind: 'ok';
      draftId: string;
      revision: number;
      updatedAt: number | null;
    }
  | {
      kind: 'stale_revision';
      currentRevision: number;
      yourRevision: number;
    }
  | { kind: 'active_draft_exists'; existingDraftId: string }
  | { kind: 'unauthorized' }
  | { kind: 'rate_limited' }
  | { kind: 'bad_request'; reason: string }
  | { kind: 'network_error' }
  | { kind: 'unknown_error'; status: number; body?: unknown };

export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  const payload: Record<string, unknown> = {
    data: input.data,
    draftState: input.draftState,
    persistenceStatus: 'ACTIVE',
  };
  if (input.draftId) {
    payload.draftId = input.draftId;
  }
  if (typeof input.expectedRevision === 'number') {
    payload.expectedRevision = input.expectedRevision;
  }
  if (input.step === 1 || input.step === 2 || input.step === 3) {
    payload.step = input.step;
  }

  let res: Response;
  try {
    res = await fetch('/api/drafts/save', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { kind: 'network_error' };
  }

  let body: {
    ok?: boolean;
    draftId?: string;
    revision?: number;
    updatedAt?: number | null;
    error?: string;
    currentRevision?: number;
    yourRevision?: number;
    existingDraftId?: string;
  } | null = null;
  try {
    body = await res.json();
  } catch {
    return { kind: 'unknown_error', status: res.status };
  }

  if (
    res.status === 200 &&
    body?.ok === true &&
    typeof body.draftId === 'string' &&
    typeof body.revision === 'number'
  ) {
    return {
      kind: 'ok',
      draftId: body.draftId,
      revision: body.revision,
      updatedAt: typeof body.updatedAt === 'number' ? body.updatedAt : null,
    };
  }
  if (res.status === 401) {
    return { kind: 'unauthorized' };
  }
  if (res.status === 429) {
    return { kind: 'rate_limited' };
  }
  if (res.status === 409 && body?.error === 'STALE_REVISION') {
    return {
      kind: 'stale_revision',
      currentRevision:
        typeof body.currentRevision === 'number' ? body.currentRevision : 0,
      yourRevision:
        typeof body.yourRevision === 'number' ? body.yourRevision : 0,
    };
  }
  if (res.status === 409 && body?.error === 'ACTIVE_DRAFT_EXISTS') {
    return {
      kind: 'active_draft_exists',
      existingDraftId:
        typeof body.existingDraftId === 'string' ? body.existingDraftId : '',
    };
  }
  if (res.status === 400) {
    return {
      kind: 'bad_request',
      reason: typeof body?.error === 'string' ? body.error : 'BAD_REQUEST',
    };
  }
  return { kind: 'unknown_error', status: res.status, body };
}
