// ============================================================================
// /types/draft.ts — Cross-device draft persistence types (PR #18a)
//
// Three-layer vocabulary (DO NOT collapse):
//   1. UIStage          — cinematic / navigation. Existing AppStage enum.
//   2. DraftState       — business milestone. This file. Monotonic forward-only.
//   3. PersistenceStatus — operational lifecycle. This file.
//
// localStorage is live working memory; RTDB is the recovery snapshot. RTDB
// stores `draftState` and `persistenceStatus`. UIStage stays client-only and
// is NEVER persisted as the source-of-truth field.
// ============================================================================

import type { CoupleData } from '../types';

export type DraftState =
  | 'IN_PROGRESS'
  | 'GENERATED'
  | 'REFINED'
  | 'PREVIEWED'
  | 'READY_FOR_PAYMENT'
  | 'COMPLETED';

export type PersistenceStatus = 'ACTIVE' | 'PAUSED' | 'ABANDONED';

// Forward-index for monotonicity enforcement. Client observer references this.
// MUST stay in sync with DRAFT_STATE_ORDER in /api/lib/draftValidation.js —
// that file is the JS mirror used by Vercel-Node endpoints which cannot
// import from this .ts file at runtime.
export const DRAFT_STATE_ORDER: Record<DraftState, number> = {
  IN_PROGRESS: 0,
  GENERATED: 1,
  REFINED: 2,
  PREVIEWED: 3,
  READY_FOR_PAYMENT: 4,
  COMPLETED: 5,
};

// Type guards — used by the permissive draft validator and endpoints to
// reject unknown enum values without throwing.
const DRAFT_STATE_VALUES: ReadonlySet<string> = new Set(Object.keys(DRAFT_STATE_ORDER));
const PERSISTENCE_STATUS_VALUES: ReadonlySet<string> = new Set(['ACTIVE', 'PAUSED', 'ABANDONED']);

export function isDraftState(value: unknown): value is DraftState {
  return typeof value === 'string' && DRAFT_STATE_VALUES.has(value);
}

export function isPersistenceStatus(value: unknown): value is PersistenceStatus {
  return typeof value === 'string' && PERSISTENCE_STATUS_VALUES.has(value);
}

export interface DraftDocument {
  draftId: string;
  userId: string;
  data: Partial<CoupleData>;
  step?: 1 | 2 | 3;
  draftState: DraftState;
  persistenceStatus: PersistenceStatus;
  createdAt: number;
  updatedAt: number;
}
