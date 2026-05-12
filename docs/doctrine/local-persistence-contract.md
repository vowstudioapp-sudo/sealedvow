# Local Persistence Contract

**Status:** Active doctrine. Binding on all creator-flow work.
**Established:** 12 May 2026, with PR-47 + PR-47.1.
**Context:** [Diagnostic-1](../diagnostics/state-authority-hydration-conflict.md), [Diagnostic-2](../diagnostics/2026-05-12-mount-authority-replay.md), the PR-47 / PR-47.1 implementation cycle.

This document is the load-bearing reference for any code that touches local browser persistence in the creator flow. Amendments require explicit doctrine review; silent deviations are bugs.

---

## 1. Single authority

`localStorage['vday_data_draft']` is the **sole** local persistence authority for creator composition state in SealedVow.

There is exactly one read site at mount (the `data` `useState` initializer in [App.tsx](../../App.tsx)), one mount-time peek inside PreparationForm ([components/PreparationForm.tsx](../../components/PreparationForm.tsx)), and a fixed set of writers — all in [hooks/usePreparationPersistence.ts](../../hooks/usePreparationPersistence.ts) — that share the single key and the single `selectiveHydrate` filter.

No other localStorage key may carry creator composition state. This includes the historical sibling `vday_data` (post-Refine snapshot), removed by PR-47.1 because its independent lifecycle produced the cross-letter contamination documented in Diagnostic-2.

## 2. Extension protocol — adding fields that need recovery fidelity

When a new field is added to `CoupleData` and needs to survive a refresh, extend the existing allowlists in [hooks/usePreparationPersistence.ts](../../hooks/usePreparationPersistence.ts):

- **Primitives** (string, number, boolean, string union) → add to `TEXT_SAFE_FIELDS`. The `selectiveHydrate` allowlist will pass them through verbatim.
- **Structured values, URL-bearing objects, optional objects** → add to `MEDIA_FIELDS_RESTORED` *and* add a defensive validator branch inside `selectiveHydrate`. The validator must:
  - Verify the stored shape is plausible (e.g., required string fields are non-empty strings; nested objects have their required keys).
  - Reconstruct a minimal, type-safe shape (never trust the on-disk blob wholesale).
  - Silently drop invalid values rather than crashing the renderer or aborting the hydration.

The pattern is established by the existing `memoryBoard`, `userImageUrl`, `audio`, `video`, `aiImageUrl`, and `sacredLocation` validators. Match that pattern.

No field requiring recovery fidelity is allowed to bypass `selectiveHydrate` by writing or reading a parallel key.

## 3. Forbidden pattern — independent local snapshot authorities

The PATTERN of two or more independent local persistence surfaces holding overlapping composition state is **forbidden**. The disease produced by that pattern is documented in Diagnostic-1 and Diagnostic-2: mismatched lifecycle discipline between buckets, no shared identity, no precedence rule that can be safely written, mount-time contamination, cross-letter contamination, payment-completed contamination.

The forbidden pattern includes but is not limited to:

- "Quick restore" caches that mirror in-memory `data` to a second localStorage key for "fast first paint." If the canonical authority is too slow at first paint, fix that — do not shadow-write.
- "Refined preview" snapshots that capture post-Refine state to a second key for "preview fidelity." All refined-state fidelity lives in the surviving authority via the extended `selectiveHydrate` allowlist.
- "Session mirror" buckets keyed to `sessionStorage` or a sibling `localStorage` key for "in-tab continuity." `sessionStorage` is fine for *non-composition* signals (route hints, intentional-entry flags, decoded receiver caches). It is **not** a place to mirror composition state.
- Parallel `localStorage` keys for "partial composition state," "draft revision history," "auto-save N", etc. The single canonical bucket plus the cloud-draft system in [`api/drafts/*`](../../api/drafts/) are the only two layers; do not add a third.

If a new product requirement appears to need a second local bucket — pause and amend this doctrine first. The Diagnostic-2 §8 ranking of directional alternatives (UID-namespacing, identity-link, cloud-canonical) is the starting point for that conversation; choosing among them is an architectural decision, not an implementation detail.

## 4. Server-set fields — server is authority

These fields **must not** be restored from local persistence:

- `status` (LetterStatus lifecycle)
- `sealedAt` (ISO timestamp — set at payment verification)
- `createdAt`, `updatedAt` (server timestamps)
- `previewExpiresAt` (ISO timestamp)
- `replyEnabled` (server-side configuration)

These values are written by [api/verify-payment.js](../../api/verify-payment.js) into `shared/{sessionKey}` on Firebase RTDB and surface to the client either through the receiver-side `usePathLinkLoader` flow or via the cloud-draft `/api/drafts/list` reconciliation. Restoring a stale local copy of any of these would lie about a state the server has not yet authorized.

If a new server-set field is added, exclude it from the `selectiveHydrate` allowlist by omission. Do not add it to `TEXT_SAFE_FIELDS` or `MEDIA_FIELDS_RESTORED`.

## 5. Security / PII — explicit hygiene boundary

These fields **must not** be restored from local persistence:

- `passcodeEnabled`, `passcodeHint`, `passcodeHashRef` (passcode flow — sensitive even when hashed)
- `receiverPhoneNumber` (PII)

The boundary is explicit, not incidental. Even though these fields may be written to `vday_data_draft` by `writeDraft` (which serializes the full `data` object), the read filter `selectiveHydrate` deliberately drops them. The on-disk write may continue (replacing the write contract is out of scope for this doctrine); the read filter is the authoritative hygiene checkpoint.

If a new security-sensitive or PII field is added to `CoupleData`, the default is exclusion. Adding it to the allowlist requires explicit product-and-security review.

## 6. Architectural rule — at every layer

> **Persistence observes composition. It does not govern composition.**

The rule applies at three layers:

| Layer | Application |
|---|---|
| **Write** | Persistence mirrors in-memory `data` (debounced) and stage transitions (synchronous in `safeSetStage`). It never asserts authority back into composition during the same session. Writes are observations of state changes that have already happened in memory. |
| **Mount** | The `data` `useState` initializer reads exactly one persistence surface, exactly once, with no precedence question (there is no second bucket). Composition begins from that hydrated value; subsequent edits are sovereign. |
| **Stage transitions** | The resolver `useEffect`'s `NO_LINK` branch is intentionally empty. Persistence is not read; persistence is not consulted. Composition state in memory is sovereign across transitions. (Path B closure via PR-47.) |

Any future change that introduces a *new* read of local persistence into a non-mount surface (effect, callback, render path) must justify itself against this rule. The default answer is no.

## 7. What the contract does *not* cover

- **Cloud-draft persistence** ([`api/drafts/save`](../../api/drafts/save.js), [`api/drafts/list`](../../api/drafts/list.js), [`api/drafts/transition`](../../api/drafts/transition.js)). The cloud-draft system is the authoritative cross-device draft store for signed-in users. Its relationship to local persistence is currently: cloud is the per-user, per-letter authority; local `vday_data_draft` is the per-tab crash-recovery buffer. Promoting cloud to *also* be the mount-time creator-state authority (Diagnostic-2 §8.6 Option A — cloud-canonical) is a future direction; this doctrine does not require it.
- **Receiver-side caches** ([`utils/sharePathHints.ts`](../../utils/sharePathHints.ts) sessionStorage payload cache, the Eid-decoded-data bridge). These are receiver-flow concerns and are out of scope for the creator-state contract.
- **Schema migration**. If `vday_data_draft`'s `CURRENT_SCHEMA_VERSION` is bumped (v2 → v3), the migration policy is a separate document. The contract here is about authority structure, not schema evolution.
- **Quota-error UX**. PR-47.1 left the post-Refine quota banner removed (D1). Restoring symmetric, user-visible quota-error signaling across the surviving writers (`writeDraft`, `writeDraftFromExternal`, `writeStage`, `writeDraftId`) is a Phase 1 stabilization item. The contract does not prescribe the UX; it only requires that, if quota signaling is added back, it does not re-introduce a parallel authority.

## 8. Reference — implementation cycle that produced this contract

- [Diagnostic-1](../diagnostics/state-authority-hydration-conflict.md) — characterized Path B (the resolver-effect re-fire stomp), classified the disease as "incorrect source-of-truth selection," ranked five fix options.
- **PR-47** — implemented Diagnostic-1 §13 Option 5: moved data restoration out of the stage-keyed effect into the mount-only `useState` initializer. Closed Path B.
- [Diagnostic-2](../diagnostics/2026-05-12-mount-authority-replay.md) — characterized Path A (mount-time precedence between the two buckets), proved the bug reproduces in fresh incognito once persistence is populated, ranked six directional fixes — Option F first by minimum-surface-to-resolve.
- **PR-47.1** — implemented Diagnostic-2 §8.1 Option F: extended `selectiveHydrate` allowlist (preserving refined-state fidelity), removed `vday_data` constant + helpers + storage banner, rewired the Refine handoff through `writeDraftFromExternal`. Closed Path A by construction.
- **This doctrine** — codifies the resulting authority structure so it cannot be silently re-violated by future work.

---

End of doctrine.
