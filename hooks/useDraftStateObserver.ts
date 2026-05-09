// ============================================================================
// /hooks/useDraftStateObserver.ts — Client-side draft-state observer (PR #18a;
// activated in PR #18b)
//
// Observes UIStage transitions, derives the candidate DraftState, and fires a
// /api/drafts/transition call ONLY at milestone boundaries (monotonic). Pure
// decision logic lives in /hooks/draftStateLogic.ts (testable without React).
//
// Activation contract (live as of PR #18b):
//   - `enabled && !!draftId` → observer is active; transitions write to RTDB.
//   - Otherwise → early return short-circuits BEFORE any candidate computation,
//     so the anonymous case (and rapid UIStage churn during cinematic flow when
//     no draft exists yet) costs zero work per render.
//
// Activation seeding (load-bearing for PR #18b's "no redundant /transition
// after explicit save" guarantee):
//   - On the render where the observer transitions inactive → active, if
//     `seedDraftState` is provided, the lastPersistedDraftStateRef is initialized
//     to that value BEFORE the candidate/monotonicity check runs.
//   - Without seeding, activation would always fire a /transition for the
//     current UIStage (because the ref starts at null), producing a same-tick
//     duplicate write right after /save (or a 409 right after /list hydration
//     when the cloud is already further along).
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
  // Seed value applied to lastPersistedDraftStateRef on the render where the
  // observer transitions inactive → active. See "Activation seeding" above.
  seedDraftState?: DraftState;
}

export function useDraftStateObserver({
  uiStage,
  draftId,
  enabled,
  seedDraftState,
}: UseDraftStateObserverArgs): void {
  const lastPersistedDraftStateRef = useRef<DraftState | null>(null);
  const pendingRequestIdRef = useRef(0);
  const previouslyActiveRef = useRef(false);

  useEffect(() => {
    const isActive = enabled && !!draftId;

    // Inactive — short-circuit BEFORE candidate computation. Reset the
    // activation tracker so the next activation (if any) re-seeds correctly.
    if (!isActive) {
      previouslyActiveRef.current = false;
      return;
    }

    // Just-activated edge — seed the persisted-state ref before the monotonic
    // check runs, so a /save-then-activate or /list-hydrate-then-activate
    // does not produce a redundant /transition for the current UIStage.
    if (!previouslyActiveRef.current) {
      if (seedDraftState !== undefined) {
        lastPersistedDraftStateRef.current = seedDraftState;
      }
      previouslyActiveRef.current = true;
    }

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
  }, [uiStage, draftId, enabled, seedDraftState]);
}
