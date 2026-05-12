# PR-46 CLOSED — Send "letter sealed" email to authenticated senders on payment success
**Status:** Merged and verified in production
**Merge commit:** `40a2076`
**Amendment commit:** `2d32b85`
**Branch:** `pr46-email-on-payment-success` (retained for next cleanup sweep)
**Merged:** 11 May 2026, ~23:38 IST (implementation `40a2076`); amendment `2d32b85` ~23:42 IST
**Deployed:** Vercel deploy `b280b00cu`, READY at 23:54:53 IST 11 May 2026
**Verified in production:** Test transaction at 01:02:30 IST 12 May 2026 (payment ID `pay_SoAooFwBCanjPv`)
---
## What this PR did
Added a post-payment-success email notification to authenticated senders. After Razorpay capture confirms and `markActiveDraftCompleted` succeeds, the verify-payment handler now calls `sendLetterSealedNotification`, which dispatches a "Your letter has been sealed." email via Resend to the sender's authenticated email address. The email contains a receipt block (amount paid, payment ID, date) rendered in Charter-compliant editorial typography.
## Why this PR existed
After PR-45 (Resend email infrastructure setup), the product had email-sending capability but no integration into the payment success flow. A sender could pay ₹249, receive nothing in their inbox, and have no record of the transaction outside of the share link itself. Three problems followed from this:
1. **Trust gap.** Charter section II non-negotiable 06 (Trust) requires the product not to behave like a transaction the sender cannot verify after the fact. An emailed receipt is the minimum trust artifact.
2. **Recovery gap.** A sender who lost the share link tab before sharing had no way to retrieve it.
3. **Word-of-mouth gap.** The Receiver Review identifies "delayed introduction email to receiver 24-48 hours after open" as a future re-engagement channel. That channel requires the email infrastructure to be wired through verify-payment first.
This PR closes the immediate sender-side trust gap for the authenticated subset of users. The guest subset is intentionally deferred to PR-46.5.
## Architecture
### Call site
Single integration point at `api/verify-payment.js`, razorpay-success path, approximately line 694 (after `markActiveDraftCompleted`, before the success log line). The founder/influencer path (`amountPaise <= 0`) does NOT call the helper — see "Amendment" below.
### Helper signature
```javascript
sendLetterSealedNotification({
  sessionUser,    // full senderSessionUser object captured at auth resolve site
  sanitized,      // sanitized couple data
  paymentId,      // Razorpay payment ID
  amountPaise,    // amount in paise (paid path: > 0)
  requestId       // for log correlation
})
```
The helper is defined at the top of `verify-payment.js` (module-scope, not imported) following the same discipline as `markActiveDraftCompleted` — co-located, never throws, never affects HTTP response.
### Three guards
The helper short-circuits in three cases, all logged but none thrown:
1. **No authenticated sender.** If `sessionUser?.email` is absent, the helper logs `[Verify] Email skipped — no authenticated sender email` and returns. This is the guest path. V1 silent skip is intentional; PR-46.5 will provide the recovery pathway.
2. **Founder/influencer path.** If `amountPaise <= 0`, the helper logs `[Verify] Email skipped — founder path (no charge)` and returns. The founder path receives no receipt because there is no receipt to render. This was originally a ceremonial-call site (covered by the helper's own guard); the amendment removed the call to keep logs clean.
3. **Idempotency.** Before dispatching the email, the helper checks `notifications/{paymentId}` in RTDB. If a record exists with `letterSealedSentAt`, the email has already been sent for this payment and the helper short-circuits. This prevents duplicate emails on webhook retries or manual replay.
### Idempotency record location
The idempotency record lives at `notifications/{paymentId}`, NOT at `payments/{paymentId}`. This is a deliberate architectural choice. The multi-path write at `verify-payment.js:664` (the main fulfillment write) overwrites `payments/{paymentId}` on every retry, which would lose the notification flag. The separate `notifications/` path is write-only-on-first-send and survives subsequent retries.
The record structure (post-amendment):
```javascript
{
  letterSealedSentAt: <server timestamp>,
  resendMessageId: <Resend's returned message ID>
}
```
`resendMessageId` was added in the amendment for operational visibility. It enables future debugging ("did Resend actually accept this?") and dashboard surfacing without re-querying Resend's API.
### Email template
Located in `lib/email/sendEmail.js`, function `sendLetterSealedEmail`. Locked artifact — PR-46 did not modify it. Signature:
```javascript
sendLetterSealedEmail({
  to,              // recipient email
  senderName,      // sender's name from couple data (fallback: 'there')
  formattedAmount, // e.g., '₹249.00'
  paymentId,       // Razorpay payment ID
  formattedDate    // e.g., '12 May 2026'
})
  // returns: Promise<{ok: boolean, id?: string, error?: any}>
  // never throws
```
- Subject: `Your letter has been sealed.`
- Sign-off: `— SEALED VOW`
- Receipt block: editorial restraint, thin gold hairlines, NOT boxed/fintech.
- Date format: `toLocaleDateString('en-GB', {day, month, year, timeZone: 'Asia/Kolkata'})` → "12 May 2026".
- Amount format: `` `₹${(amountPaise / 100).toFixed(2)}` `` → "₹249.00".
### Latency
The helper is `await`ed, not fired-and-forgotten. Fire-and-forget is unsafe on Vercel Node runtime — the function can be terminated before the email dispatch completes. Synchronous await adds approximately 250-1000ms latency to the verify-payment HTTP response. This is accepted because:
- The user is already on a success-loading screen at this point; perceived latency is bounded.
- Failing CLOSED on the email is preferable to failing CLEAN with no record.
- The alternative (background queue) is over-architected for current scale.
Documented in the helper's docstring.
## Amendment (commit `2d32b85`)
Three changes from the initial PR-46 merge:
1. **Dropped founder-symmetry call.** The initial implementation called the helper from the founder path as well, relying on Guard 2 to short-circuit. This was ceremonial code — the call always logged "Email skipped — founder path" and did no work. Removed for log cleanliness.
2. **Persisted `resendMessageId`.** The initial implementation only stored `letterSealedSentAt` on the idempotency record. Added `resendMessageId` capture from the email lib's return value for operational visibility.
3. **Documented latency tradeoff in helper docstring.** The synchronous-await decision was implicit in the initial merge; the amendment made it explicit.
## Verification
### Three test transactions
**Test 1 — Validator-drift failure (00:05:28 IST 12 May 2026)**
- Razorpay captured ₹249 on order `order_So9q9GgBiRYea6`
- `validateCoupleData` rejected `musicUrl: ''` from frontend (empty-string optional)
- verify-payment returned HTTP 400, frontend showed "Invalid session data"
- Payment captured, no fulfillment, no email
- **Discovery:** This surfaced the validator drift bug. Patched in PR-46.1 before scale traffic hit. Manual refund processed 12 May 2026 morning.
**Test 2 — Guest checkout (00:44:09 IST 12 May 2026)**
- Founder paid as guest (not signed in; confirmed by 401s on `/api/drafts/list`)
- Validator passed (post-PR-46.1 deploy)
- Share link generated: `https://www.sealedvow.com/abc--xyz--6r4dpquv`
- Helper executed Guard 1 (no authenticated sender) — logged `[Verify] Email skipped — no authenticated sender email`
- No email arrived (expected, V1 silent skip)
- **Discovery:** Surfaced the guest-email gap as a real production behavior. Became input to PR-46.5 scope.
- Manual refund processed 12 May 2026 morning.
**Test 3 — Authenticated success (01:02:30 IST 12 May 2026)**
- Founder properly signed in (verified via My Letters page)
- Payment captured: `pay_SoAooFwBCanjPv`
- Validator passed, fulfillment succeeded, helper dispatched email
- Email arrived in Gmail (slight latency, expected for new sender domain)
- Template rendered correctly: subject, receipt block between gold hairlines, amount ₹249.00, payment ID, date 12 May 2026, sign-off — SEALED VOW
- **Charter discipline held end-to-end.** Manual refund processed 12 May 2026 morning (test transaction).
### Vercel deployment
Deploy `b280b00cu`, READY at 23:54:53 IST 11 May 2026. Post-amendment redeploy followed amendment commit. Production runtime: `verify-payment` invocations show consistent 250-1000ms additional latency for authenticated paths, baseline latency for guest paths.
## Discoveries during this PR
1. **Architectural contract drift between frontend and backend.** Frontend HTML inputs emit `''` for untouched optional URL fields; Zod `.optional()` interprets `''` as present-but-invalid, not absent. This is a real bug class. PR-46.1 patched one instance; expect more.
2. **Guest-skip behavior is a product question, not just an engineering one.** Silent V1 skip is technically defensible but creates trust gap. PR-46.5 needs to address this at the trust-architecture level, not just by adding a second helper call.
3. **`payments/{paymentId}` is unstable for ancillary flags.** The multi-path write at line 664 overwrites it. Any future post-payment ancillary state (notifications, retries, audit) needs a separate path.
4. **Three-voice discipline + observation window earned their keep.** The discovery of the validator drift bug came from running an E2E test within the observation window. Without it, the bug would have shipped to scale traffic.
## Forward links
- **PR-46.5** — Seal confirmation for every paying customer (guests + founder-code recipients). Trust architecture, not just feature work.
- **PR-47** — Lazy Redis / fail-open middleware. Protects against Upstash outage breaking ALL routes that import middleware (including verify-payment).
- **PR-48** — Auto-refund safety net at post-capture failure points (specifically the case that surfaced in Test 1).
- **Analytics PR (future)** — Email send success rate, guest/auth ratio, validation failure rate.
## Doctrine reaffirmed
- "Battle-tested > elegant" — synchronous await accepted over architecturally-purer queue.
- "Failed CLOSED instead of failing DIRTY" — Test 1 caught the validator bug before fulfillment, not after.
- Helper pattern (`markActiveDraftCompleted`, now `sendLetterSealedNotification`) is the right shape for never-throws ancillary work after payment success. Future ancillary work (analytics, audit, etc.) should follow the same pattern.
---
*Closure date: 12 May 2026, ~09:30 IST.*
*Author: Ajmal Fahad.*
*Voices: Claude.ai (Charter filter), Claude Code (implementation), ChatGPT (third opinion).*
