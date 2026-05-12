// ============================================================================
// /api/drafts/discard.js — Mark a draft as ABANDONED (PR-48 Phase 3, ATR-5
// per contract §5.5 — the "Delete" contract op = client-facing "Discard").
//
// Auth required. Single-draft transaction on users/{uid}/drafts/{draftId}.
// Revision-CAS protected; idempotent same-state no-op when already ABANDONED.
//
// Discard is allowed from ACTIVE and PAUSED. Going ACTIVE → ABANDONED simply
// relaxes the single-ACTIVE invariant (post-op the user has zero ACTIVEs),
// which is valid per doctrine §6.5 ("Count(ACTIVE) ∈ {0,1}").
//
// Body:   { draftId, expectedRevision }
// Success 200: { ok, draftId, persistenceStatus: 'ABANDONED', revision, updatedAt }
// No-op 200 (already ABANDONED): same shape with unchanged revision/updatedAt.
// Errors:
//   400 MISSING_FIELDS / MISSING_EXPECTED_REVISION / INVALID_EXPECTED_REVISION_FORMAT
//   401 Unauthorized
//   404 DRAFT_NOT_FOUND
//   409 STALE_REVISION { currentRevision, yourRevision }
//   429 TOO_MANY_REQUESTS
//   500 TRANSACTION_FAILED
//
// Per Stage 2 decision 2: expectedRevision > stored is NOT rejected. Only
// expectedRevision < stored triggers STALE_REVISION.
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
    keyPrefix: 'drafts:discard',
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

  // Pre-fetch advisory: already-ABANDONED is a no-op success (idempotent).
  if (existing.persistenceStatus === 'ABANDONED') {
    return res.status(200).json({
      ok: true,
      draftId,
      persistenceStatus: 'ABANDONED',
      revision: typeof existing.revision === 'number' ? existing.revision : 1,
      updatedAt: existing.updatedAt ?? null,
    });
  }

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

      // Same-state defense: concurrent discard between pre-fetch and tx.
      if (current.persistenceStatus === 'ABANDONED') {
        return current; // commit unchanged; response echoes current
      }

      // Revision check. Per Stage 2 decision 2: only reject if client BEHIND
      // server (STALE_REVISION). Client AHEAD is allowed.
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

      // Apply transition: any non-ABANDONED → ABANDONED, revision += 1.
      return {
        ...current,
        persistenceStatus: 'ABANDONED',
        revision: storedRevision + 1,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };
    });
  } catch (err) {
    console.error('[drafts/discard] Transaction threw:', err?.message ?? err);
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  if (!txResult.committed) {
    if (abortReason) {
      return res.status(abortReason.http).json(abortReason.body);
    }
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  const writtenSnap = await draftRef.once('value');
  const written = writtenSnap.val();

  return res.status(200).json({
    ok: true,
    draftId,
    persistenceStatus: written?.persistenceStatus ?? 'ABANDONED',
    revision: written?.revision ?? null,
    updatedAt: written?.updatedAt ?? null,
  });
}
