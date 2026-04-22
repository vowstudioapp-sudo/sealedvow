// ============================================================================
// /api/lib/auth.js — Session cookie parsing + verification
//
// Used by /api/auth/* routes to create/clear session cookies, and by
// protected routes (via getSessionUser) to identify the current user.
// Pairs with Firebase Admin's createSessionCookie / verifySessionCookie.
// ============================================================================

import { adminAuth } from './middleware.js';

export const SESSION_COOKIE_NAME = '__session';

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (name) out[name] = value;
  }
  return out;
}

/**
 * Returns the decoded session user ({ uid, email, name, ... }) or null.
 * Verifies against revoked tokens so disabled accounts are rejected.
 */
export async function getSessionUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!token) return null;
  try {
    return await adminAuth.verifySessionCookie(token, true);
  } catch {
    return null;
  }
}
