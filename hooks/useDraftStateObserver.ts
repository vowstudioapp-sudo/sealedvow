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
  // PR-48 Phase 3: seed value applied to lastPersistedRevisionRef on the
  // same just-activated edge. The observer sends expectedRevision on every
  // /api/drafts/transition call (per doctrine §6 and contract §6).
  // If null at fire time (no revision known yet — e.g., post-mount before
  // /list hydration completes), the fire is skipped because the server
  // requires expectedRevision; the next genuine UIStage milestone after
  // hydration fires correctly.
  currentRevision?: number | null;
}

export function useDraftStateObserver({
  uiStage,
  draftId,
  enabled,
  seedDraftState,
  currentRevision,
}: UseDraftStateObserverArgs): void {
  const lastPersistedDraftStateRef = useRef<DraftState | null>(null);
  // PR-48 Phase 3: revision tracker, symmetric to lastPersistedDraftStateRef.
  const lastPersistedRevisionRef = useRef<number | null>(null);
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

    // Just-activated edge — seed the persisted-state refs before the
    // monotonic check runs, so a /save-then-activate or /list-hydrate-then-
    // activate does not produce a redundant /transition for the current
    // UIStage.
    if (!previouslyActiveRef.current) {
      if (seedDraftState !== undefined) {
        lastPersistedDraftStateRef.current = seedDraftState;
      }
      if (currentRevision !== undefined) {
        lastPersistedRevisionRef.current = currentRevision;
      }
      previouslyActiveRef.current = true;
    }

    const decision = decideTransition(uiStage, lastPersistedDraftStateRef.current);
    if (decision.kind !== 'write') return;

    // PR-48 Phase 3: skip the fire if we don't yet know our revision.
    // /api/drafts/transition requires expectedRevision; sending without
    // it would 400. The next genuine UIStage milestone after hydration
    // fires correctly once draftRecord.revision becomes non-null.
    if (lastPersistedRevisionRef.current === null) return;

    const candidate = decision.candidate;
    const candidateExpectedRevision = lastPersistedRevisionRef.current;

    // Race protection (1) — capture previous state BEFORE optimistic update.
    const previousDraftState = lastPersistedDraftStateRef.current;
    const previousRevision = lastPersistedRevisionRef.current;
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
      body: JSON.stringify({
        draftId,
        draftState: candidate,
        expectedRevision: candidateExpectedRevision,
      }),
    })
      .then((r) =>
        r.json().then((body) => ({ status: r.status, ok: r.ok, body })),
      )
      .then(({ ok, body }) => {
        // Race protection (3) — only act if no newer request has fired.
        if (requestId !== pendingRequestIdRef.current) return;

        if (ok && body?.ok) {
          // Success path: capture server's revision so subsequent fires
          // use the fresh value. Server returns the (possibly unchanged)
          // revision in both committed and same-state-no-op responses.
          if (typeof body.revision === 'number') {
            lastPersistedRevisionRef.current = body.revision;
          }
          return;
        }

        // STALE_REVISION recovery (per Stage 1 item #7 / Stage 2 plan):
        // capture currentRevision from response and DO NOT retry. The
        // next genuine UIStage milestone fires correctly with the fresh
        // revision. lastPersistedDraftStateRef rolls back; the milestone
        // is effectively re-attempted at the next render cycle.
        if (body?.error === 'STALE_REVISION' && typeof body.currentRevision === 'number') {
          lastPersistedRevisionRef.current = body.currentRevision;
          lastPersistedDraftStateRef.current = previousDraftState;
          return;
        }

        // Generic failure — roll back both refs together so the activation
        // edge can re-seed cleanly if the observer is re-activated.
        lastPersistedDraftStateRef.current = previousDraftState;
        lastPersistedRevisionRef.current = previousRevision;
      })
      .catch(() => {
        // Network failure — same staleness guard, roll both refs.
        if (requestId === pendingRequestIdRef.current) {
          lastPersistedDraftStateRef.current = previousDraftState;
          lastPersistedRevisionRef.current = previousRevision;
        }
      });
  }, [uiStage, draftId, enabled, seedDraftState, currentRevision]);
}
