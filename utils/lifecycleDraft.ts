// ============================================================================
// utils/lifecycleDraft.ts — Canonical lifecycle-endpoint helpers (PR-48 Phase 4)
//
// Pure typed-result wrappers around POST /api/drafts/pause and
// POST /api/drafts/discard. Resume is Phase 5 — not exported here.
//
// No React state. No localStorage writes. No orchestration. Callers handle
// revision tracking, local state, UX, and multi-step sequencing.
// ============================================================================

import type { PersistenceStatus } from '../types/draft';

export type LifecycleResult =
  | {
      kind: 'ok';
      draftId: string;
      persistenceStatus: PersistenceStatus;
      revision: number;
      updatedAt: number | null;
    }
  | {
      kind: 'stale_revision';
      currentRevision: number;
      yourRevision: number;
    }
  | { kind: 'illegal_status_transition'; from: string; to: string }
  | { kind: 'not_found' }
  | { kind: 'unauthorized' }
  | { kind: 'rate_limited' }
  | { kind: 'bad_request'; reason: string }
  | { kind: 'network_error' }
  | { kind: 'unknown_error'; status: number; body?: unknown };

interface LifecycleInput {
  draftId: string;
  expectedRevision: number;
}

async function callLifecycle(
  endpoint: string,
  input: LifecycleInput,
): Promise<LifecycleResult> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { kind: 'network_error' };
  }

  let body: {
    ok?: boolean;
    draftId?: string;
    persistenceStatus?: PersistenceStatus;
    revision?: number;
    updatedAt?: number | null;
    error?: string;
    currentRevision?: number;
    yourRevision?: number;
    from?: string;
    to?: string;
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
    typeof body.revision === 'number' &&
    (body.persistenceStatus === 'ACTIVE' ||
      body.persistenceStatus === 'PAUSED' ||
      body.persistenceStatus === 'ABANDONED')
  ) {
    return {
      kind: 'ok',
      draftId: body.draftId,
      persistenceStatus: body.persistenceStatus,
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
  if (res.status === 404) {
    return { kind: 'not_found' };
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
  if (res.status === 409 && body?.error === 'ILLEGAL_STATUS_TRANSITION') {
    return {
      kind: 'illegal_status_transition',
      from: typeof body.from === 'string' ? body.from : '',
      to: typeof body.to === 'string' ? body.to : '',
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

export function pauseDraft(input: LifecycleInput): Promise<LifecycleResult> {
  return callLifecycle('/api/drafts/pause', input);
}

export function discardDraft(input: LifecycleInput): Promise<LifecycleResult> {
  return callLifecycle('/api/drafts/discard', input);
}
