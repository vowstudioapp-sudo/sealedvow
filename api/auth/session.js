// ============================================================================
// /api/auth/session.js — Exchange Firebase ID token for session cookie
//
// Client calls this immediately after signInWithPopup succeeds, sending
// the fresh ID token. We verify it server-side and issue an HttpOnly
// session cookie valid for 5 days. Cookie flows automatically on
// subsequent same-origin requests.
// ============================================================================

import { adminAuth, guardPost } from '../lib/middleware.js';
import { SESSION_COOKIE_NAME } from '../lib/auth.js';

const EXPIRES_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const MAX_TOKEN_AGE_SEC = 5 * 60;            // reject stale ID tokens

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  // Never cache auth responses.
  res.setHeader('Cache-Control', 'no-store');

  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'idToken required' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Require a fresh sign-in (within 5 min) to mint a session cookie.
    // Shrinks the replay window for stolen ID tokens.
    if (Date.now() / 1000 - decoded.auth_time > MAX_TOKEN_AGE_SEC) {
      return res.status(401).json({ error: 'Recent sign-in required' });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: EXPIRES_MS,
    });

    const isProd =
      process.env.VERCEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production';

    const cookie = [
      `${SESSION_COOKIE_NAME}=${sessionCookie}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${Math.floor(EXPIRES_MS / 1000)}`,
      ...(isProd ? ['Secure'] : []),
    ].join('; ');

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
    });
  } catch (err) {
    console.error('[Auth] Session creation failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
