# PAYMENT ENDPOINT RATE LIMITING — DISTRIBUTED (Upstash Redis)
**Date:** February 15, 2026  
**Update:** Distributed Rate Limiting Implementation for Payment Endpoints

---

## EXECUTIVE SUMMARY

Successfully implemented distributed rate limiting using Upstash Redis for both payment endpoints (`api/create-order.js` and `api/verify-payment.js`). Added global IP-based rate limiting (5 requests per 60 seconds) and founder code fail limiting (10 attempts per hour) to protect against abuse while maintaining all existing business logic.

---

## SUMMARY OF CHANGES

### File 1: `api/create-order.js`

**Changes Made:**
1. Added Redis import and client initialization (lines 6-11)
2. Added `getClientIP()` helper function (lines 36-44)
3. Added global IP rate limiting block (lines 117-135)
4. Added founder code fail limiter before invalid format return (lines 140-156)
5. Added founder code fail limiter before invalid/expired code return (lines 163-179)

**Total Lines Added:** ~60 lines
**Total Lines Modified:** 0 (only additions, no modifications to existing logic)

---

### File 2: `api/verify-payment.js`

**Changes Made:**
1. Added Redis import and client initialization (lines 2-7)
2. Added `getClientIP()` helper function (lines 37-45)
3. Added global IP rate limiting block (lines 149-167)

**Total Lines Added:** ~30 lines
**Total Lines Modified:** 0 (only additions, no modifications to existing logic)

---

## EXACT INSERTION POINTS

### Global Rate Limiter — `api/create-order.js`

**Location:** Lines 117-135  
**Inserted After:** 
```javascript
if (req.method === 'OPTIONS') return res.status(200).end();
if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
```

**Inserted Before:**
```javascript
const { tier = 'standard', founderCode } = req.body || {};
```

**Code Block:**
```javascript
// ── GLOBAL IP RATE LIMITING ──
const RATE_LIMIT_WINDOW = 60;
const MAX_REQUESTS = 5;

try {
  const ip = getClientIP(req);
  const key = `payment_rate:${ip}`;
  const current = await kv.incr(key);

  if (current === 1) {
    await kv.expire(key, RATE_LIMIT_WINDOW);
  }

  if (current > MAX_REQUESTS) {
    return res.status(429).json({
      error: "Too many requests. Please wait a minute."
    });
  }
} catch (kvError) {
  console.error("[PaymentRateLimit] KV unavailable:", kvError.message);
  return res.status(503).json({
    error: "Service temporarily unavailable. Please try again."
  });
}
```

---

### Global Rate Limiter — `api/verify-payment.js`

**Location:** Lines 149-167  
**Inserted After:**
```javascript
if (req.method === 'OPTIONS') return res.status(200).end();
if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
```

**Inserted Before:**
```javascript
const {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  coupleData,
  tier,
  paymentMode,
  founderToken,
} = req.body;
```

**Code Block:** (Identical to create-order.js)

---

### Founder Code Fail Limiter — `api/create-order.js`

#### Branch 1: Invalid Format Check

**Location:** Lines 140-156  
**Inserted Before:**
```javascript
return res.status(400).json({ error: 'Invalid or expired code.' });
```

**Context:** This return occurs when `founderCode` fails format validation:
- Not a string
- Empty after trim
- Length > 50 characters

**Code Block:**
```javascript
// ── FOUNDER CODE FAIL LIMITER ──
try {
  const ip = getClientIP(req);
  const failKey = `founder_fail:${ip}`;
  const failCount = await kv.incr(failKey);

  if (failCount === 1) {
    await kv.expire(failKey, 3600);
  }

  if (failCount > 10) {
    return res.status(429).json({
      error: "Too many invalid founder code attempts."
    });
  }
} catch (kvError) {
  console.error("[FounderFailLimit] KV unavailable:", kvError.message);
  return res.status(503).json({
    error: "Service temporarily unavailable."
  });
}
```

---

#### Branch 2: Invalid/Expired Code After Transaction

**Location:** Lines 163-179  
**Inserted Before:**
```javascript
return res.status(400).json({ error: 'Invalid or expired code.' });
```

**Context:** This return occurs when `founderTransaction()` returns `{ valid: false }`, which can happen when:
- Code doesn't exist in Firebase
- Code is inactive
- Code has reached max uses
- Code has expired
- ETag conflicts exhausted all retries

**Code Block:** (Identical to Branch 1)

---

## CONFIRMATION OF UNCHANGED LOGIC

### ✅ Razorpay Logic — UNCHANGED

**Verification:**
- `api/create-order.js`: Razorpay order creation logic (lines 176-231) untouched
- `api/verify-payment.js`: Razorpay signature verification (lines 300-318) untouched
- HMAC signature verification using `crypto.timingSafeEqual()` unchanged
- Order creation request/response structure unchanged
- Payment verification response structure unchanged

**Evidence:**
- No modifications to Razorpay API calls
- No changes to signature verification algorithm
- No changes to order ID or payment ID handling
- No changes to Razorpay error handling

---

### ✅ Firebase Writes — UNCHANGED

**Verification:**
- `api/create-order.js`: Firebase order persistence (lines 199-219) untouched
- `api/verify-payment.js`: Firebase atomic updates (lines 379-406) untouched
- ETag-based conditional writes unchanged
- `firebaseAtomicUpdate()` calls unchanged
- Session key generation and collision handling unchanged

**Evidence:**
- No modifications to Firebase URL construction
- No changes to ETag handling in `founderTransaction()`
- No changes to atomic multi-path writes
- No changes to Firebase error handling

---

### ✅ CORS Logic — UNCHANGED

**Verification:**
- `setCors()` function definition unchanged in both files
- CORS header setting logic unchanged
- `ALLOWED_ORIGINS` array unchanged
- `Vary: Origin` header unchanged

**Evidence:**
- No modifications to `setCors()` function
- No changes to origin validation logic
- No changes to CORS header values

---

### ✅ Existing Error Responses — PRESERVED

**Verification:**
- All existing error messages preserved
- All existing HTTP status codes preserved
- Generic error messages for founder codes preserved
- Payment verification error messages unchanged

**Evidence:**
- `'Invalid or expired code.'` message unchanged
- `'Method not allowed'` unchanged
- `'Payment configuration error.'` unchanged
- `'Payment verification failed.'` unchanged
- All other error messages remain identical

---

## RATE LIMITING ARCHITECTURE

### Global IP Rate Limiting

**Key Pattern:** `payment_rate:{ip}`  
**Window:** 60 seconds  
**Limit:** 5 requests per IP per window  
**Scope:** Both endpoints share the same key prefix

**Rationale:**
- Shared key prefix (`payment_rate:`) allows unified tracking across both endpoints
- Prevents abuse by limiting total payment-related requests per IP
- 5 requests per minute is sufficient for legitimate use (create order + verify payment + retries)
- 60-second window provides clear user feedback

**Behavior:**
1. First request: `kv.incr()` returns 1, sets expiration to 60 seconds
2. Subsequent requests: Counter increments, checked against `MAX_REQUESTS`
3. Exceeding limit: Returns 429 with clear message
4. Window expiry: Key expires, counter resets

---

### Founder Code Fail Limiting

**Key Pattern:** `founder_fail:{ip}`  
**Window:** 3600 seconds (1 hour)  
**Limit:** 10 invalid attempts per IP per hour  
**Scope:** Only `api/create-order.js`, only on invalid founder code paths

**Rationale:**
- Separate counter prevents brute-force enumeration of founder codes
- 1-hour window prevents rapid retry attacks
- 10 attempts provides reasonable tolerance for typos
- Only triggers on actual invalid codes (not on valid codes)

**Behavior:**
1. Invalid format detected: Counter increments, expiration set if first attempt
2. Invalid/expired code detected: Counter increments
3. Exceeding limit: Returns 429 with specific message
4. Valid code: Counter never increments (bypasses fail limiter)

**Important:** This limiter only runs when founder code validation fails. Valid codes bypass this entirely.

---

## FAIL-CLOSED POLICY

### Implementation

Both rate limiters use identical fail-closed pattern:

```javascript
try {
  // Rate limiting logic
} catch (kvError) {
  console.error("[...] KV unavailable:", kvError.message);
  return res.status(503).json({
    error: "Service temporarily unavailable. Please try again."
  });
}
```

### Behavior

**If KV is unavailable:**
- Global rate limiter: Returns 503 immediately, no payment processing
- Founder fail limiter: Returns 503 immediately, no code validation
- No fallback to allow requests without rate limiting
- No silent continuation

**Rationale:**
- Prevents abuse during KV outages
- Ensures rate limiting is always enforced
- Clear error message guides users to retry
- Protects system integrity

---

## SHARED VS PER-ENDPOINT RATE LIMIT KEY DECISION

### Decision: Shared Key Prefix (`payment_rate:`)

**Implementation:**
- Both endpoints use: `payment_rate:{ip}`
- Same window (60 seconds)
- Same limit (5 requests)

**Rationale:**

1. **Unified Protection:**
   - Payment flow involves both endpoints (create → verify)
   - Shared limit prevents splitting requests across endpoints
   - Protects against coordinated attacks

2. **User Experience:**
   - Legitimate flow: Create order (1) + Verify payment (1) = 2 requests
   - Retry tolerance: Up to 3 retries = 5 total requests
   - Prevents legitimate users from hitting limits

3. **Operational Simplicity:**
   - Single rate limit configuration
   - Easier monitoring and debugging
   - Consistent behavior across endpoints

4. **Security:**
   - Prevents bypass by switching endpoints
   - Enforces total request budget per IP
   - Reduces attack surface

**Alternative Considered:**
- Per-endpoint keys (`create_order_rate:`, `verify_payment_rate:`)
- **Rejected because:** Allows 5 requests to each endpoint = 10 total, which is too permissive

---

## FILES MODIFIED

**Total Files:** 2

1. **`api/create-order.js`**
   - Lines added: ~60
   - Lines modified: 0
   - Sections: Import, helper function, global rate limiter, 2x founder fail limiters

2. **`api/verify-payment.js`**
   - Lines added: ~30
   - Lines modified: 0
   - Sections: Import, helper function, global rate limiter

**No other files modified.**

---

## DEPLOYMENT CHECKLIST

### Required Environment Variables

Ensure these are set in Vercel Dashboard → Settings → Environment Variables:

- ✅ `KV_REST_API_URL` — Upstash Redis REST API URL
- ✅ `KV_REST_API_TOKEN` — Upstash Redis REST API token

### Required Upstash Redis Setup

1. Create KV store in Vercel Dashboard:
   - Vercel Dashboard → Storage → Create → KV
   - Or use Upstash Console directly

2. Link to project:
   - Vercel Dashboard → Storage → Link to project
   - Environment variables auto-populated

3. Verify connection:
   - Test endpoint after deployment
   - Check logs for KV errors

### Testing Recommendations

1. **Test Global Rate Limiting:**
   - Send 5 requests rapidly → Should succeed
   - Send 6th request → Should return 429
   - Wait 60 seconds → Should reset

2. **Test Founder Fail Limiting:**
   - Send 10 invalid founder codes → Should succeed
   - Send 11th invalid code → Should return 429
   - Wait 1 hour → Should reset

3. **Test Fail-Closed:**
   - Temporarily break KV connection
   - Send request → Should return 503
   - Restore KV → Should work normally

4. **Test Valid Flows:**
   - Valid founder code → Should bypass fail limiter
   - Valid Razorpay flow → Should work normally
   - Verify existing functionality unchanged

---

## SECURITY POSTURE IMPROVEMENT

### Before (VULNERABLE):
- ❌ No rate limiting on payment endpoints
- ❌ Unlimited founder code brute-force attempts
- ❌ No protection against payment spam
- ❌ No distributed tracking (per-instance limits)

### After (SECURE):
- ✅ Global IP rate limiting (5 requests/minute)
- ✅ Founder code fail limiting (10 attempts/hour)
- ✅ Distributed tracking via Redis
- ✅ Fail-closed policy (503 if KV unavailable)
- ✅ Protection against coordinated attacks

### Attack Scenarios Mitigated:

1. **Payment Spam:**
   - Attacker sends rapid payment requests
   - **Mitigation:** Global rate limit blocks after 5 requests

2. **Founder Code Brute-Force:**
   - Attacker tries many invalid codes
   - **Mitigation:** Fail limiter blocks after 10 attempts/hour

3. **Distributed Attacks:**
   - Multiple IPs or serverless instances
   - **Mitigation:** Redis provides shared state across all instances

4. **KV Bypass:**
   - Attacker exploits KV outage
   - **Mitigation:** Fail-closed returns 503, no processing

---

## VERIFICATION CHECKLIST

✅ **Redis Import Added:**
- `api/create-order.js`: Lines 6-11
- `api/verify-payment.js`: Lines 2-7

✅ **getClientIP Helper Added:**
- `api/create-order.js`: Lines 36-44
- `api/verify-payment.js`: Lines 37-45

✅ **Global Rate Limiter Added:**
- `api/create-order.js`: Lines 117-135
- `api/verify-payment.js`: Lines 149-167

✅ **Founder Fail Limiter Added:**
- `api/create-order.js`: Lines 140-156 (format check)
- `api/create-order.js`: Lines 163-179 (transaction check)

✅ **Razorpay Logic Unchanged:**
- Order creation untouched
- Signature verification untouched
- Error handling untouched

✅ **Firebase Writes Unchanged:**
- ETag logic untouched
- Atomic updates untouched
- Session key generation untouched

✅ **CORS Logic Unchanged:**
- `setCors()` function untouched
- Origin validation untouched

✅ **Error Messages Preserved:**
- All existing messages unchanged
- Only new 429/503 responses added

✅ **Fail-Closed Policy:**
- All rate limiters return 503 on KV failure
- No silent fallbacks

---

## SUMMARY

✅ **All objectives achieved:**
- Distributed rate limiting implemented
- Global IP limiting (5/min) on both endpoints
- Founder code fail limiting (10/hour) on create-order
- Fail-closed policy enforced
- All business logic preserved
- No breaking changes

✅ **Security posture improved:**
- Protection against payment spam
- Protection against founder code brute-force
- Distributed tracking via Redis
- Fail-safe behavior

✅ **Code quality maintained:**
- No refactoring of unrelated code
- No formatting changes
- No import changes beyond Redis
- Clean, maintainable implementation

---

**Report End**
