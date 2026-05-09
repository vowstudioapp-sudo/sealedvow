// ============================================================================
// /hooks/useDraftStateObserver.ts — Client-side draft-state observer (PR #18a)
//
// Observes UIStage transitions, derives the candidate DraftState, and fires a
// /api/drafts/transition call ONLY at milestone boundaries (monotonic). Pure
// decision logic lives in /hooks/draftStateLogic.ts (testable without React).
//
// PR #18a mounts this hook in App.tsx in DORMANT mode (enabled=false,
// draftId=null) — see Section 10 of the implementation prompt. The early
// return on !enabled || !draftId short-circuits BEFORE any candidate
// computation, so dormant mounting costs zero work per render.
//
// 18b is the first caller that activates it by passing real values for
// `enabled` and `draftId`.
//
// Race protection — three details that must all be present:
//   1. previousDraftState captured into a local const BEFORE the optimistic
//      ref assignment. Rollback uses the local capture (not a re-read).
//   2. requestId via pre-increment ++pendingRequestIdRef.current captured
//      into a local const at the time the request is dispatched.
//   3. Both rejection and network-failure paths roll back ONLY when
//      requestId === pendingRequestIdRef.current. A stale rejection arriving
//      AFTER a newer successful write must NOT regress the ref.
// ============================================================================

import { useEffect, useRef } from 'react';
import type { AppStage } from '../types';
import type { DraftState } from '../types/draft';
import { decideTransition } from './draftStateLogic';

interface UseDraftStateObserverArgs {
  uiStage: AppStage;
  draftId: string | null;
  enabled: boolean;
}

export function useDraftStateObserver({
  uiStage,
  draftId,
  enabled,
}: UseDraftStateObserverArgs): void {
  const lastPersistedDraftStateRef = useRef<DraftState | null>(null);
  const pendingRequestIdRef = useRef(0);

  useEffect(() => {
    // CRITICAL early return — short-circuits BEFORE candidate computation.
    // Dormant mounting (PR #18a) and rapid UIStage churn during cinematic
    // auto-advance both rely on this guard to do zero work.
    if (!enabled || !draftId) return;

    const decision = decideTransition(uiStage, lastPersistedDraftStateRef.current);
    if (decision.kind !== 'write') return;

    const candidate = decision.candidate;

    // Race protection (1) — capture previous state BEFORE optimistic update.
    const previousDraftState = lastPersistedDraftStateRef.current;
    // Race protection (2) — pre-increment, capture into local const.
    const requestId = ++pendingRequestIdRef.current;

    // Optimistic update — guards against thundering-herd retries during
    // rapid stage changes (each render of a new milestone-bearing UIStage
    // sees the local ref already advanced, so decideTransition no-ops).
    lastPersistedDraftStateRef.current = candidate;

    fetch('/api/drafts/transition', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, draftState: candidate }),
    })
      .then((r) => r.json())
      .then((json) => {
        // Race protection (3) — rollback only if no newer request has fired.
        if (!json?.ok && requestId === pendingRequestIdRef.current) {
          lastPersistedDraftStateRef.current = previousDraftState;
        }
      })
      .catch(() => {
        // Same staleness guard applies to network failure.
        if (requestId === pendingRequestIdRef.current) {
          lastPersistedDraftStateRef.current = previousDraftState;
        }
      });
  }, [uiStage, draftId, enabled]);
}
