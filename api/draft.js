/**
 * PR-49 Phase B — Singular authenticated-mode draft endpoint.
 *
 * Distinct from api/drafts/* (PR-48 legacy multi-draft surface with state
 * machine, CAS, pause/resume/discard semantics). This file is the canonical
 * PR-49 authenticated-mode reader/deleter; Phase D removes most of api/drafts/*
 * while this file remains as the final state.
 *
 * Currently DORMANT — no client code calls these endpoints. Phase C wires them
 * into the persistence dispatcher.
 *
 * Per strategy §9.2 + §10:
 *   GET    /api/draft  → returns the user's one cloud draft (or 404)
 *   DELETE /api/draft  → sweeps all keys under users/{uid}/drafts (idempotent)
 *
 * TRANSITIONAL FILTERING: GET filters out persistenceStatus === 'ABANDONED'.
 * This filter exists only during PR-48 → PR-49 migration coexistence.
 * Phase D removes persistenceStatus from the schema entirely; at that point
 * this filter becomes a no-op and should be deleted along with the schema
 * field.
 *
 * INLINE CORS ALLOW-METHODS: The shared setCors helper writes
 * "Access-Control-Allow-Methods: POST, OPTIONS" (correct for the PR-48
 * surface). This file overrides that header inline to "GET, DELETE, OPTIONS"
 * rather than mutating setCors. Phase B preserves the shared helper's
 * existing semantics; cross-cutting generalization is a separate concern.
 */

import { adminDb, setCors, rateLimit } from './lib/middleware.js';
import { getSessionUser } from './lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getSessionUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') return handleGet(req, res, user);
  return handleDelete(req, res, user);
}

async function handleGet(req, res, user) {
  const { limited } = await rateLimit(req, {
    keyPrefix: 'draft:get',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  try {
    const snap = await adminDb.ref(`users/${user.uid}/drafts`).once('value');
    const raw = snap.val();

    if (!raw || typeof raw !== 'object') {
      return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
    }

    const all = Object.values(raw).filter(Boolean);
    const totalDrafts = all.length;
    const filtered = all.filter((d) => d.persistenceStatus !== 'ABANDONED');

    if (totalDrafts > 1) {
      console.warn('[PR-49] Legacy multi-draft state detected', {
        uid: user.uid,
        totalDrafts,
        recoverableDrafts: filtered.length,
      });
    }

    if (filtered.length === 0) {
      return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
    }

    filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const chosen = filtered[0];

    return res.status(200).json({
      data: chosen.data,
      draftState: chosen.draftState,
      step: chosen.step,
      phase: chosen.phase,
      createdAt: chosen.createdAt,
      updatedAt: chosen.updatedAt,
      draftId: chosen.draftId,
    });
  } catch (err) {
    console.error('[draft GET] Read failed:', err?.message ?? err);
    return res.status(500).json({ error: 'READ_FAILED' });
  }
}

async function handleDelete(req, res, user) {
  const { limited } = await rateLimit(req, {
    keyPrefix: 'draft:delete',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  try {
    const ref = adminDb.ref(`users/${user.uid}/drafts`);
    const snap = await ref.once('value');
    const raw = snap.val();

    const all = raw && typeof raw === 'object' ? Object.values(raw).filter(Boolean) : [];
    const totalDrafts = all.length;

    if (totalDrafts > 1) {
      const recoverableDrafts = all.filter((d) => d.persistenceStatus !== 'ABANDONED').length;
      console.warn('[PR-49] Legacy multi-draft state detected', {
        uid: user.uid,
        totalDrafts,
        recoverableDrafts,
      });
    }

    await ref.remove();

    return res.status(200).json({ ok: true, deleted: totalDrafts });
  } catch (err) {
    console.error('[draft DELETE] Write failed:', err?.message ?? err);
    return res.status(500).json({ error: 'WRITE_FAILED' });
  }
}
