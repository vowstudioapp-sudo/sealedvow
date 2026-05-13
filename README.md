# SealedVow

A long-form sealed-letter product. One sender writes one letter, for one person, for one occasion. The receiver opens it through a slow, cinematic experience. Payment seals the letter. Once sealed, it becomes immutable.

This repository is the production codebase. It is not open source. Documentation in this README is for future-self, future collaborators, and internal engineering reference.

## What's in this repo

- A React 19 SPA that hosts both the creator flow (write, refine, preview, pay) and the receiver flow (open, navigate, reply).
- Vercel serverless functions under `api/` that handle authentication, AI generation, payments, draft persistence, and media uploads.
- Firebase (Auth + Realtime Database + Storage) for identity, durable storage, and media hosting.
- A second smaller product surface (Eidi) for the Eid 2026 occasion, gated behind feature flags in `config/features.ts`. Currently off in production.

The product charter and the receiver-experience design language live outside this repo (the founder maintains them separately). When code decisions touch product principles, the relevant proposal under `docs/proposals/` will reference them inline.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 5, Tailwind CSS, Framer Motion. Cinematic surfaces use dedicated CSS files in `styles/` (`envelope.effects.css`, `ignition.effects.css`, etc.) loaded from `index.html`.
- **Backend:** Node.js (ESM) serverless functions on Vercel, under `api/`.
- **Identity & storage:** Firebase Auth (Google sign-in), Realtime Database (sessions, drafts), Firebase Storage (media).
- **Rate limiting:** Upstash Redis. Soft-fails when Redis is unavailable; do not change that. See `api/lib/middleware.js`.
- **AI:** Google Gemini primary, OpenAI fallback for text actions. Dispatched through a single endpoint at `api/ai.js` with a whitelist of allowed actions and a per-request cap.
- **Payments:** Razorpay. Single price ₹249 (24,900 paise). Founder-code redemption uses an RTDB transaction for atomicity.
- **Email:** Resend, via `lib/email/sendEmail.js`. Used for the seal-confirmation email after payment.
- **Validation:** Zod, primarily inside `lib/coupleDataValidator.js` at payment time.

There is no test runner configured. `npm run build` runs `tsc` (typecheck, no emit) followed by `vite build`. TypeScript is the only enforced static check.

## Local development

```
npm install
npm run dev        # Vite on port 3000
```

`/api/*` is proxied to `http://localhost:3001`. Run the Vercel functions separately in another terminal:

```
vercel dev --listen 3001
```

Production smoke from the built bundle:

```
npm run build
npm run preview
```

### Dev preview shortcuts

Append `?preview=intro|envelope|letter|receiver` (with optional `&theme=obsidian|velvet|crimson|midnight|evergreen|pearl`) to any URL in dev mode. `App.tsx` seeds mock data and jumps directly to that stage. See `App.tsx`'s dev-preview branch.

## Environment variables

There is no `.env.example` in the repo. The variables below are read by the running app; populate `.env.local` for development. Production secrets live in Vercel.

Required for the client (Vite-exposed):

- `GEMINI_API_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_DB_URL`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

Required for serverless functions:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DB_URL`
- `FIREBASE_STORAGE_BUCKET`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `OPENAI_API_KEY` (fallback for text generation)
- `ADMIN_SECRET` (admin endpoints)
- `PUBLIC_SITE_URL` (canonical origin for share links in the seal email; falls back to `VERCEL_URL` then `https://www.sealedvow.com`)

TODO: add a sanitized `.env.example` to the repo root for new-machine setup.

## Project structure

```
App.tsx                  Root component and AppStage state machine
index.tsx                Bootstrap; global error listeners
api/                     Vercel serverless functions (Node.js, ESM)
  drafts/                Cloud-draft endpoints (list, save, transition; pause/resume/discard slated for removal)
  auth/                  Session cookie minting
  admin/                 Admin-only endpoints + reconciliation cron handler
  letters/               Sent-letters list
  lib/                   Server middleware: Firebase Admin, Upstash, rate limit, guardPost
components/              React components (cinematic stages + modals)
  experience/, landing/  Receiver-side and landing-page pieces
hooks/                   Custom React hooks (auth, persistence, link loaders, media)
utils/                   Pure helpers (routing, slug/share, save/lifecycle wrappers)
lib/                     Shared client+server code (validators, email, AI providers)
services/                Firebase + Gemini service wrappers
pages/                   Eidi pages (eidi/create, eidi/receiver) and admin/claims
config/features.ts       Feature flags (Object.freeze; do not mutate at runtime)
data/                    Demo data for /demo routes
public/                  Static assets (logos, favicon, lp/)
src/                     Localized content strings
styles/                  Cinematic CSS files loaded directly from index.html
scripts/                 Hand-rolled .mjs smoke scripts for specific concerns
docs/                    Doctrine, contracts, proposals, diagnostics, audits
```

Notes:

- `App.tsx` is intentionally large. It centralizes the `AppStage` enum, the pure `resolveStage()` function (whose branches are commented with the specific bugs they prevent), all top-level effects, and the link loaders. Read `resolveStage` carefully before changing transition logic.
- Lazy-loaded components (everything that is not the landing page) must stay lazy. Boot performance and bundle splitting depend on it.
- All API routes import Firebase Admin and Upstash from `api/lib/middleware.js`. Do not re-initialize either elsewhere.

## Architecture overview

This is a single-page React app on Vercel. The client owns flow state and renders cinematic stages. The serverless backend owns identity, durable persistence, AI calls, and payments. Firebase Realtime Database holds sessions, drafts, and shared receiver payloads. Media is in Firebase Storage. Rate-limiting state is in Upstash.

A few load-bearing details that aren't obvious from the file layout:

- **Routing.** `utils/routing.ts` is the single source of truth for URL → flow. There is no React Router. `vercel.json` rewrites everything except `/api/*` to `/index.html` so the client resolver runs on every path. Receiver share codes match `^/[A-Za-z0-9_-]{5,}$`; Eidi receiver codes match `^/eidi/[A-Z0-9]{6}$`.
- **State immutability.** Every reducer-shaped update in this codebase uses functional setters and never mutates arrays or objects in place. This is enforced by convention. See `.cursorrules` and the comment near the top of `App.tsx`. Mutation has caused real production bugs in the past under React 19's concurrent rendering.
- **Auth and the cookie race.** Client-side `useAuth` (`hooks/useAuth.ts`) exposes both `user` and `serverSessionReady`. The latter flips true only after `POST /api/auth/session` has minted the session cookie. Authenticated fetches must gate on `serverSessionReady`, not just `user`. The race was diagnosed in `docs/diagnostics/` and is real on slow networks.
- **Persistence.** Local autosave lives in `localStorage` under `vday_data_draft`, gated by an allow-list filter (`selectiveHydrate`) in `hooks/usePreparationPersistence.ts`. Cloud drafts live in Firebase RTDB at `users/{uid}/drafts/{draftId}`. Authority crosses between the two only at explicit synchronization boundaries — hydration at sign-in or mount, a successful save, or a successful destructive reconciliation. Between those boundaries, the in-memory working copy is sovereign and neither side speaks for the other. There are no background sync helpers, periodic revision watchdogs, or ambient authority arbiters. The full contract is in `docs/doctrine/local-persistence-contract.md`. See "Current architecture direction" below.
- **AI dispatcher.** `api/ai.js` accepts a whitelisted `action` and dispatches to the right provider. Gemini is primary; the text actions fall back to OpenAI on validation failure. There is a per-request cap (`MAX_AI_CALLS`) — keep it.
- **Payments.** `api/create-order.js` creates a Razorpay order at the fixed price. `api/verify-payment.js` HMAC-verifies the signature, marks the draft `COMPLETED`, writes the shared receiver payload, and triggers the seal-confirmation email. Founder-code redemption uses an RTDB `transaction()` for atomicity — preserve that pattern.
- **Security rules.** `firestore.rules` denies all (Firestore is not used). `database.rules.json` denies all client access — every read and write goes through the Admin SDK in `api/`. Storage rules are separate and live in `storage.rules`.

For broader context that doesn't fit here, the `docs/` tree carries the doctrine, contracts, and proposals that produced the current code.

## Current architecture direction

The persistence layer has gone through several iterations. The relevant history:

- **PR-47 / PR-47.1** collapsed two parallel local-state buckets into a single `vday_data_draft` authority. Mount-time and resolver-effect cross-contamination is closed.
- **PR-48 Phase 1–4** attempted multi-draft cloud sync with an ACTIVE/PAUSED/ABANDONED state machine and a three-button reconciliation modal. Built end-to-end; reverted before merging to production. The architectural mismatch was diagnosed in `docs/diagnostics/2026-05-13-phase4-continue-dashboard-bug.md` and the doctrine reversal in `docs/proposals/single-draft-pivot.md` (v1.2).
- **PR-48.A** began the single-draft pivot. Commit 1 (Phase A — subtractive removals) landed on `pr48-cloud-draft-sync` at `14c1e9c`. Commits 2–6 were abandoned in favor of the dual-mode model described below. The strategy doc at `docs/proposals/pr-48a-implementation-strategy.md` is superseded; preserved for institutional learning only.

The next direction is a **dual-mode persistence model** — anonymous-mode and signed-in-mode treated as distinct authorities with explicit boundaries between them, rather than as a single authority parameterized by auth state. The design will be written up under `docs/proposals/dual-mode-persistence.md` (forthcoming).

`docs/proposals/pr-48a-implementation-strategy.md` remains useful as historical context for the single-draft pivot and Commit 1's subtractive removals, but the active architectural direction is now the dual-mode persistence proposal. `docs/proposals/single-draft-pivot.md` v1.2 stays useful for the product-level reasoning that ruled out reconciliation-based multi-draft. `docs/doctrine/local-persistence-contract.md` remains the foundational rule for local state.

**Do not reintroduce reconciliation-based multi-draft.** The cut was philosophical, not technical; the reasoning is documented in `single-draft-pivot.md §1`.

## Non-goals

This product intentionally avoids:

- social feeds
- collaborative editing
- inbox-style notifications
- productivity-style draft management
- engagement loops
- public profiles
- multi-user authoring

Many architectural decisions in this codebase only make sense in the context of these exclusions.

## Deployment

Deployed on Vercel. The Vite build output goes to `dist/`. Branches map to environments:

- `main` → production
- `development` → staging
- Feature branches (`pr<N>-<slug>` or `pr<N>.<sub>-<slug>`) → preview deployments via Vercel

`vercel.json` defines per-function `maxDuration` limits and a daily cron at `/api/admin/reconcile-payments` (20:30 UTC). The reconciliation job sweeps orphaned payments — do not disable it without understanding what it cleans up.

## Branch and workflow conventions

Reading the git log will tell you most of the convention:

- One PR per architectural change, numbered (`PR-46`, `PR-47`, `PR-48`).
- Sub-phases use dotted suffixes (`PR-46.5`, `PR-47.1`, `PR-48.A`).
- Branch names follow the PR number and a short slug: `pr48-cloud-draft-sync`, `pr47-state-authority-fix`, `pr46-5-trust-continuity-cursor`.
- Doctrine-only branches use `docs/pr<N>-<slug>`.
- Commits within a PR live on its branch. Squash to `development`. Fast-forward `development` → `main` after audit.

The repo uses no test runner, so every PR's audit happens via:

1. `npm run build` (TypeScript + Vite build must both pass).
2. Manual smoke tests, listed in the relevant proposal/strategy doc (see `docs/proposals/pr-48a-implementation-strategy.md §6` for an example).
3. Doctrine review against `docs/doctrine/` and `docs/proposals/`.

## Important docs

Read these before making non-trivial changes:

- `docs/proposals/dual-mode-persistence.md` — active architectural doctrine for the persistence layer. Authoritative for any change touching draft storage, sign-in flow, or save semantics.
- `CLAUDE.md` — concise architectural map (current truth). Useful as a fast overview.
- `docs/doctrine/local-persistence-contract.md` — load-bearing rules for local state. Amendments require explicit doctrine review.
- `docs/proposals/single-draft-pivot.md` (v1.2) — (superseded by dual-mode persistence) product-level doctrine that ruled out reconciliation-based multi-draft. Preserved for the reasoning trail.
- `docs/proposals/pr-48a-implementation-strategy.md` — (superseded — only Commit 1 of six shipped) operational spec for the abandoned single-draft migration. Preserved for institutional learning.
- `docs/contracts/active-paused-state-machine.md` — superseded multi-draft contract. Will be archived under `docs/archived/` as part of the dual-mode persistence transition. Preserved for institutional learning per `single-draft-pivot.md §10.4`. Do not extend it.
- `docs/diagnostics/` — root-cause writeups for past incidents. Worth grepping before re-diagnosing a similar symptom.

Repo-root reports (audit snapshots from earlier phases — historical, not authoritative for current state):

- `PROJECT_AUDIT_REPORT.md`, `TECHNICAL_AUDIT_REPORT.md`, `TECHNICAL_AUDIT_MASTER_REPORT.md`
- `SECURITY_FIXES_VERIFICATION_REPORT.md`
- `PAYMENT_RATE_LIMITING_REPORT.md`
- `TIMESTAMP_INCONSISTENCY_ANALYSIS.md`
- `EIDI_FEATURE_PROPOSAL.md`

External design references (maintained outside this repo):

- TODO: SealedVow Product Charter — referenced in `single-draft-pivot.md §1.1` (Section V — "What SealedVow Is Not"); not currently checked into the repo. If kept external, add a pointer to its canonical location.
- TODO: SealedVow Receiver Experience Review — referenced in earlier internal discussions; not in the repo.
- TODO: PostLaunch Architecture Roadmap — referenced in `single-draft-pivot.md §14.3` as a target for post-merge updates; not in the repo.

## Things that look odd but are intentional

- **`importmap` in `index.html`** coexists with the Vite-bundled build. Do not remove without verifying both `npm run dev` and the Vercel build still work.
- **App.tsx seeds `sessionStorage.eidDecodedData`** from a successfully loaded `sharedData` when `occasion === 'eid'`. This is the bridge between the legacy decoded-link path and the Eid flow's session storage contract.
- **Receiver flow preserves `currentStage`** once past `LANDING` even when `linkState === SUCCESS` re-fires. The comment in `resolveStage` explains the "name keeps flashing" loop this avoids.
- **Rate limiter soft-fails** when Upstash is down (`api/lib/middleware.js`). Past outage taught this. Do not change to a 5xx — there is a comment explaining the history.
- **`guardPost` does not protect Razorpay webhooks.** Razorpay sends `application/x-www-form-urlencoded`. The webhook handler reads the body directly.

## Common operations

Run a single function for local testing:

```
vercel dev --listen 3001
```

Inspect a specific draft in dev Firebase RTDB:

```
users/{uid}/drafts/{draftId}
```

Clear local autosave during a smoke test:

```js
localStorage.removeItem('vday_data_draft');
```

Persistence-key namespacing is currently under architectural review as part of the dual-mode persistence proposal.

Reset the founder-code claim state for a test code (Admin only):

See `api/admin-generate-founder-codes.js` and the matching RTDB nodes. Do not run against production.

---

If something in this README contradicts a doctrine doc under `docs/`, the doctrine doc wins. README drift is easier than doctrine drift; corrections are welcome.
