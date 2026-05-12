// ============================================================================
// /api/drafts/pause.js — Demote an ACTIVE draft to PAUSED (PR-48 Phase 3, ATR-2
// per contract §5.2 — the "Pause" client label = contract's Begin-New demote).
//
// Auth required. Single-draft transaction on users/{uid}/drafts/{draftId}.
// Revision-CAS protected; idempotent same-state no-op when already PAUSED.
//
// Body:   { draftId, expectedRevision }
// Success 200: { ok, draftId, persistenceStatus: 'PAUSED', revision, updatedAt }
// No-op 200 (already PAUSED): same shape with unchanged revision/updatedAt.
// Errors:
//   400 MISSING_FIELDS / MISSING_EXPECTED_REVISION / INVALID_EXPECTED_REVISION_FORMAT
//   401 Unauthorized
//   404 DRAFT_NOT_FOUND
//   409 STALE_REVISION { currentRevision, yourRevision }
//   409 ILLEGAL_STATUS_TRANSITION { from: 'ABANDONED', to: 'PAUSED' }
//   429 TOO_MANY_REQUESTS
//   500 TRANSACTION_FAILED
//
// Per Stage 2 decision 2 (locked from approval): expectedRevision > stored
// is NOT rejected with INVALID_REVISION. The write proceeds and the client
// self-corrects from the response's revision field.
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import { validateExpectedRevision } from '../lib/draftValidation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const user = await getSessionUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { limited } = await rateLimit(req, {
    keyPrefix: 'drafts:pause',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  const { draftId, expectedRevision } = req.body || {};

  if (!draftId || typeof draftId !== 'string') {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  const revisionCheck = validateExpectedRevision(expectedRevision, { required: true });
  if (!revisionCheck.ok) {
    return res.status(400).json({ error: revisionCheck.reason });
  }

  const draftRef = adminDb.ref(`users/${user.uid}/drafts/${draftId}`);
  const preSnap = await draftRef.once('value');
  if (!preSnap.exists()) {
    return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
  }
  const existing = preSnap.val();

  // Pre-fetch advisory checks (fast 4xx without entering transaction).
  if (existing.persistenceStatus === 'ABANDONED') {
    return res.status(409).json({
      error: 'ILLEGAL_STATUS_TRANSITION',
      from: 'ABANDONED',
      to: 'PAUSED',
    });
  }
  if (existing.persistenceStatus === 'PAUSED') {
    // Same-state no-op. No revision bump, no updatedAt bump.
    return res.status(200).json({
      ok: true,
      draftId,
      persistenceStatus: 'PAUSED',
      revision: typeof existing.revision === 'number' ? existing.revision : 1,
      updatedAt: existing.updatedAt ?? null,
    });
  }
  // Otherwise: existing.persistenceStatus === 'ACTIVE'. Proceed to transaction.

  let abortReason = null;
  let txResult;
  try {
    txResult = await draftRef.transaction((current) => {
      abortReason = null;

      if (current === null) {
        // Firebase Admin SDK null-first-call: returning preSnap.val() triggers
        // compare-and-set retry so the callback re-runs with authoritative
        // server state. Never return undefined here — that aborts without retry.
        return preSnap.val();
      }

      // Defense-in-depth re-validation inside the atomic boundary.
      if (current.persistenceStatus === 'ABANDONED') {
        abortReason = {
          http: 409,
          body: { error: 'ILLEGAL_STATUS_TRANSITION', from: 'ABANDONED', to: 'PAUSED' },
        };
        return;
      }
      if (current.persistenceStatus === 'PAUSED') {
        // Concurrent pause between pre-fetch and transaction. Treat as
        // success (idempotent) — return current unchanged so committed=true
        // but no field is mutated; the response below echoes current values.
        return current;
      }

      // Revision check. Per Stage 2 decision 2: only reject if client BEHIND
      // server (STALE_REVISION). Client AHEAD is allowed and self-corrects.
      const storedRevision =
        typeof current.revision === 'number' ? current.revision : 1;
      if (expectedRevision < storedRevision) {
        abortReason = {
          http: 409,
          body: {
            error: 'STALE_REVISION',
            currentRevision: storedRevision,
            yourRevision: expectedRevision,
          },
        };
        return;
      }

      // Apply transition: ACTIVE → PAUSED, revision += 1.
      return {
        ...current,
        persistenceStatus: 'PAUSED',
        revision: storedRevision + 1,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };
    });
  } catch (err) {
    console.error('[drafts/pause] Transaction threw:', err?.message ?? err);
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  if (!txResult.committed) {
    if (abortReason) {
      return res.status(abortReason.http).json(abortReason.body);
    }
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  // Read back to surface server-resolved updatedAt.
  const writtenSnap = await draftRef.once('value');
  const written = writtenSnap.val();

  return res.status(200).json({
    ok: true,
    draftId,
    persistenceStatus: written?.persistenceStatus ?? 'PAUSED',
    revision: written?.revision ?? null,
    updatedAt: written?.updatedAt ?? null,
  });
}
