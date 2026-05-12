# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — Vite dev server on port 3000. `/api/*` is proxied to `http://localhost:3001` (run the Vercel functions separately, e.g. `vercel dev --listen 3001`).
- `npm run build` — `tsc` typecheck (no emit) followed by `vite build` into `dist/`.
- `npm run preview` — serve the built `dist/` for smoke-testing production output.

There is no test runner, linter, or formatter configured. `tsc` runs as part of `build` and is the only enforced static check.

Required env vars (in `.env.local`): `GEMINI_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`, plus server-side `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DB_URL`, `FIREBASE_STORAGE_BUCKET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and Razorpay/OpenAI keys as referenced in the relevant `api/*.js` handlers.

**Seal-confirmation email (Vercel / server):** set `PUBLIC_SITE_URL` to the canonical public origin (production: `https://www.sealedvow.com`) so share links in email are not `*.vercel.app` deployment URLs. If unset, `getPublicSiteOrigin()` in `api/verify-payment.js` falls back to `https://${VERCEL_URL}` (preview/dev), then `https://www.sealedvow.com`. Optional alias: `VITE_PUBLIC_SITE_URL` (also read server-side).

Dev preview shortcuts (DEV-only) — append to any URL: `?preview=intro|envelope|letter|receiver`, optional `&theme=obsidian|velvet|crimson|midnight|evergreen|pearl`. `App.tsx` seeds mock `CoupleData` and jumps straight to that stage.

## Architecture

### Top-level shape
React 19 + TypeScript SPA built with Vite, Tailwind CSS, and Framer Motion. Backend is Vercel serverless functions in `api/` (Node.js, ESM). State persistence/auth/media live in Firebase (Auth + Realtime Database + Storage). Rate limiting uses Upstash Redis. AI uses Gemini primary with OpenAI text fallback. Payments via Razorpay.

There are **two parallel product flows** in one codebase:
1. **Vow letters** (default) — long-form sealed letter experience driven by the `AppStage` state machine in `App.tsx`.
2. **Eidi** (Eid 2026 feature) — separate pages under `pages/eidi/` and Eid-specific components (`Eid*`), gated by `config/features.ts` (`eidiEnabled`).

### Routing — single resolver, no React Router
`utils/routing.ts` is the **single source of truth** for URL → flow decisions. Add new routes there, not inline. `getRouteType()` returns one of: `EIDI_CREATE`, `EIDI_RECEIVER`, `EID_SELECTOR`, `EID_PREPARATION`, `DEMO_EID`, `OCCASION_SELECTOR`, `LETTER_CREATE`, `DEMO`, `API`, `RECEIVER`, `HOME`. Receiver links are short share codes matching `^/[A-Za-z0-9_-]{5,}$`; Eidi receiver codes are `^/eidi/[A-Z0-9]{6}$`. `vercel.json` rewrites everything not starting with `/api/` to `/index.html` so the client resolver runs.

### App shell + stage machine (`App.tsx`)
`App.tsx` is large (~1k lines) and intentionally centralizes:
- The `AppStage` enum state and `resolveStage(...)` pure function that maps `(routeType, linkState, sharedData, isDemoMode, isEidFlow, role, devPreview)` → next stage. **Read `resolveStage` before changing transition logic** — its branches are commented with the specific bugs they prevent (e.g. PERSONAL_INTRO loop, NO_LINK stomping creator flow).
- `useLinkLoader()` (delegates to `usePathLinkLoader` for `/abc123` style links and `useSharedLinkLoader` for legacy `#p=...` hash links — both hooks always run; only one is active).
- Persistence: creator-side data is mirrored to `localStorage` under `vday_data` via `readPersistedCoupleData` / `writePersistedCoupleData`, gated by Zod validation in `utils/validator.ts`.
- All non-landing components are `lazy()`-loaded; keep them that way — boot performance and bundle splitting depend on it.

### Domain model
`types.ts` defines a **single** domain object — `CoupleData` — used across creator and receiver. Media fields hold Firebase Storage URLs only (never base64 in state). The `LetterStatus` lifecycle (`draft → preview → paid → delivered`) and `previewExpiresAt`/`sealedAt` timestamps are server-set after payment verification.

### State updates — strict immutability (from `.cursorrules`)
This is the project's most enforced rule. **Never** mutate arrays or objects in place — no index assignment, `.push/.pop/.splice/.shift/.unshift`, no `obj.key = …`, no `delete`, no mutating spread copies. Use `.map/.filter/.reduce` and object replacement. State setters must use functional updaters (`setX(prev => …)`); never read captured `data`/`step` inside an updater. The codebase relies on referential equality under React 19 concurrent rendering — mutations cause real production bugs, not theoretical ones.

### Backend (`api/`)
- `api/lib/middleware.js` is the **only** place that should initialize Firebase Admin or Upstash Redis. Every route imports `adminDb`, `adminAuth`, `kv`, `setCors`, `getClientIP`, `rateLimit`, `guardPost` from there. Don't re-initialize these in route files.
- `guardPost(req, res)` handles OPTIONS preflight + method + `application/json` content-type. **Don't use it on Razorpay webhooks** (form-urlencoded) or `upload-media.js` if it ever moves to multipart.
- `rateLimit(...)` **intentionally soft-fails** when Redis is down (returns `{ limited: false }`, logs error). Do not change this to a 5xx — there's a comment explaining the past outage. Rate limiting is a soft dependency.
- Auth: `api/auth/session.js` accepts a Firebase ID token and sets the `__session` HttpOnly cookie via `adminAuth.createSessionCookie`. Protected routes call `getSessionUser(req)` from `api/lib/auth.js`, which verifies the cookie (with revocation check) on **every** request. Client-side `useAuth` is for UI only — never trust it for authorization.
- AI endpoint `api/ai.js`: provider-agnostic dispatcher. Whitelisted actions in `ALLOWED_ACTIONS`. Gemini is primary; `TEXT_ACTIONS` fall back to OpenAI on validation failure. A per-request guard caps total AI calls at `MAX_AI_CALLS = 8` (the counter is module-scoped but reset at handler entry — Vercel serverless serializes requests per container, so this is safe). Providers live in `lib/ai/providers/`, output validation in `lib/ai/validator.js`, prompts in `api/lib/prompt-templates.js`.
- Payments: `create-order.js` is single-price (₹249 / 24900 paise). Founder-code redemption uses a Firebase RTDB `transaction()` for atomicity — preserve that pattern when touching code redemption.
- Storage rules: `firestore.rules` denies all (Firestore is **not** used; sessions live in RTDB, media in Storage). `database.rules.json` denies all client RTDB access — all reads/writes go through the Admin SDK in API routes.

### Config & feature flags
`config/features.ts` is `Object.freeze`'d. Toggle Eidi sub-features there rather than scattering booleans through the codebase.

### Styling
Tailwind for layout/utility, plus dedicated CSS files under `styles/` loaded directly from `index.html` for cinematic scenes (`envelope.effects.css`, `ignition.effects.css`, `landing.effects.css`, `main-experience.effects.css`, `master-control.effects.css`). The Tailwind `luxury.*` palette in `tailwind.config.js` is the canonical color set; theme tokens for receiver experiences are CSS custom properties on `:root` in `styles/index.css`.

### Things that look weird but are intentional
- `index.html` ships an `importmap` for esm.sh. It coexists with the bundled Vite build — don't remove it without verifying both dev and Vercel builds.
- `App.tsx` has an effect that seeds `sessionStorage.eidDecodedData` from a successfully loaded `sharedData` when `occasion === 'eid'`. This is the bridge between the legacy decoded-link path and the Eid flow's session storage contract.
- Receiver flow preserves `currentStage` once past `LANDING` even when `linkState === SUCCESS` re-fires — see the comments in `resolveStage` to avoid reintroducing the "name keeps flashing" loop.
