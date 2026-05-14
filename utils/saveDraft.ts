// ============================================================================
// utils/saveDraft.ts — Canonical save-draft helper.
//
// Pure typed-result helper around POST /api/drafts/save. No React state. No
// localStorage writes. No side-effect orchestration. Callers handle local
// state, UX, and recovery.
//
// PR-49 C2 hotfix (LOCK-3): CAS plumbing retired. expectedRevision removed
// from the input. stale_revision variant removed from the result union.
// Under dual-mode's single-writer-per-mode invariant (I7), concurrent-edit
// conflicts cannot occur; last-write-wins is correct semantics.
//
// The `revision` field is preserved as a server-side audit counter (LOCK-4):
// the server still increments it on each write, and this helper still parses
// it from the response, but client code does not branch on it.
// ============================================================================

import type { CoupleData } from '../types';
import type { DraftState } from '../types/draft';

export interface SaveDraftInput {
  data: Partial<CoupleData> | CoupleData;
  step?: 1 | 2 | 3;
  // PR-49 Phase 1 QA: Step-2 inner phase. Server stores it; restore is
  // gated on step === 2 at the client.
  phase?: 1 | 2 | 3;
  draftState: DraftState;
  // Present → UPDATE existing draft. Absent → CREATE new draft (server
  // assigns draftId via .push().key).
  draftId?: string;
}

export type SaveDraftResult =
  | {
      kind: 'ok';
      draftId: string;
      revision: number;
      updatedAt: number | null;
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
  if (input.step === 1 || input.step === 2 || input.step === 3) {
    payload.step = input.step;
  }
  if (input.phase === 1 || input.phase === 2 || input.phase === 3) {
    payload.phase = input.phase;
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
