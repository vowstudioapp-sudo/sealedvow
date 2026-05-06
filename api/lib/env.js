// ============================================================================
// /api/lib/env.js — Cold-start required-env validation (H3)
//
// Imported as a side effect at the top of api/lib/middleware.js (covers most
// routes) and from the four routes that don't import middleware. If any
// CRITICAL env var is missing or empty, the function fails to load — Vercel
// surfaces the throw in deploy/runtime logs immediately, instead of letting
// the first paying user hit a 500.
//
// CRITICAL list is intentionally narrow (8 vars). Excluded by design:
//   - GEMINI_API_KEY / OPENAI_API_KEY: per-route 500 in api/ai.js — AI breaks
//     but payment + storage still work. Graceful partial degradation.
//   - RAZORPAY_WEBHOOK_SECRET: only one route depends on it.
//   - ADMIN_SECRET: admin-only routes; no user impact.
// To make any of those hard-required, add them to REQUIRED below.
// ============================================================================

const REQUIRED = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_DB_URL',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
];

const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k].length === 0);

if (missing.length > 0) {
  throw new Error(`[Env] Missing required environment variables: ${missing.join(', ')}`);
}
