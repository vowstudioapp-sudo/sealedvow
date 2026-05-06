// ============================================================================
// /api/auth/logout.js — Clear session cookie
// ============================================================================

import { guardPost, rateLimit } from '../lib/middleware.js';
import { SESSION_COOKIE_NAME } from '../lib/auth.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  // Never cache auth responses.
  res.setHeader('Cache-Control', 'no-store');

  // H8: per-IP rate limit. Logout is rare per-user but cheap server-side;
  // this stops abuse without blocking legitimate session cleanup.
  const { limited } = await rateLimit(req, {
    keyPrefix: 'auth_logout',
    windowSeconds: 60,
    max: 10,
  });
  if (limited) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

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
