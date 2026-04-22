// ============================================================================
// /api/auth/logout.js — Clear session cookie
// ============================================================================

import { guardPost } from '../lib/middleware.js';
import { SESSION_COOKIE_NAME } from '../lib/auth.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  // Never cache auth responses.
  res.setHeader('Cache-Control', 'no-store');

  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production';

  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(isProd ? ['Secure'] : []),
  ].join('; ');

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ signedOut: true });
}
