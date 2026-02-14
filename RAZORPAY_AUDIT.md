# Razorpay Integration Audit Report

## 🔍 Findings

### ✅ 1. Order Creation (`api/create-order.js`)

**Location:** Line 46-66
- **Method:** Direct `fetch()` to Razorpay API (not using SDK)
- **Endpoint:** `https://api.razorpay.com/v1/orders`
- **Order ID Source:** `order.id` from Razorpay response (line 66)
- **Returned as:** `orderId: order.id` (line 93)

**✅ Status:** Correct - Uses Razorpay's returned `order.id` directly

---

### ✅ 2. Frontend Integration (`components/PaymentStage.tsx`)

**Location:** Lines 96-117, 131
- **Receives:** `orderId` from `/api/create-order` response (line 96)
- **Passes to Razorpay:** `order_id: orderId` (line 117) ✅
- **Receives from Razorpay:** `response.razorpay_order_id` (line 131)
- **Sends to verification:** `razorpay_order_id: response.razorpay_order_id` (line 131)

**✅ Status:** Correct - Variable naming is consistent

---

### ✅ 3. HMAC Verification (`api/verify-payment.js`)

**Location:** Line 178-179
```javascript
const body = razorpay_order_id + '|' + razorpay_payment_id;
const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
```

**✅ Status:** CORRECT - HMAC string format is exactly:
```
order_id + "|" + payment_id
```

**Verification Method:** Uses `crypto.timingSafeEqual()` (line 183) ✅
- Prevents timing attacks
- Properly compares hex buffers

---

## ⚠️ CRITICAL ISSUES FOUND

### 🚨 Issue #1: Variable Naming Inconsistency

**Flow Analysis:**
1. **Create Order** → Returns: `orderId` (camelCase)
2. **Frontend** → Receives: `orderId`, passes as: `order_id` (snake_case)
3. **Razorpay Response** → Returns: `razorpay_order_id` (prefixed snake_case)
4. **Verification** → Receives: `razorpay_order_id` ✅

**Status:** ✅ **NO ISSUE** - The flow is correct:
- Frontend correctly maps `orderId` → `order_id` for Razorpay SDK
- Razorpay returns `razorpay_order_id` which is correctly passed through
- Verification uses `razorpay_order_id` consistently

---

### 🚨 Issue #2: Error Handling - 500 Before Signature Check

**Location:** `api/verify-payment.js` Line 169-172

```javascript
if (!keySecret || !firebaseDbUrl) {
  console.error('[Verify] Missing RAZORPAY_KEY_SECRET or FIREBASE_DB_URL');
  return res.status(500).json({ verified: false, error: 'Server configuration error.' });
}
```

**⚠️ PROBLEM:** This check happens **BEFORE** signature verification (line 178).

**Impact:** 
- If `RAZORPAY_KEY_SECRET` is missing, returns 500 **without** checking signature
- This is actually **SAFE** - prevents processing with invalid config
- But could mask signature verification issues in logs

**Recommendation:** ✅ **KEEP AS IS** - This is correct security practice (fail fast on missing secrets)

---

### 🚨 Issue #3: Environment Variable Names

**Found:**
- `api/create-order.js`: Uses `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` ✅
- `api/verify-payment.js`: Uses `RAZORPAY_KEY_SECRET` ✅

**Status:** ✅ **CONSISTENT** - Both files use same variable names

**⚠️ CHECK NEEDED:** Verify in Vercel/production:
- `RAZORPAY_KEY_ID` is set
- `RAZORPAY_KEY_SECRET` is set
- Both are **LIVE** keys (not test keys) for production

---

### 🚨 Issue #4: Test vs Live Key Mismatch

**Potential Issue:**
- `create-order.js` uses `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- `verify-payment.js` uses `RAZORPAY_KEY_SECRET`
- If one uses test keys and other uses live keys → **SIGNATURE WILL FAIL**

**Check Required:**
1. Verify both endpoints use same key pair
2. In production, ensure both are live keys
3. In development, ensure both are test keys

---

## 📊 Order ID Flow Trace

```
1. Razorpay API Response
   └─> order.id = "order_ABC123"
   
2. create-order.js (Line 93)
   └─> Returns: { orderId: "order_ABC123" }
   
3. PaymentStage.tsx (Line 96)
   └─> Receives: orderId = "order_ABC123"
   
4. PaymentStage.tsx (Line 117)
   └─> Passes to Razorpay: order_id: "order_ABC123"
   
5. Razorpay Checkout Handler (Line 131)
   └─> Returns: response.razorpay_order_id = "order_ABC123"
   
6. PaymentStage.tsx (Line 131)
   └─> Sends: razorpay_order_id: "order_ABC123"
   
7. verify-payment.js (Line 152)
   └─> Receives: razorpay_order_id = "order_ABC123"
   
8. verify-payment.js (Line 178)
   └─> HMAC: "order_ABC123|payment_XYZ789"
   
9. verify-payment.js (Line 225)
   └─> Firebase lookup: orders/order_ABC123
```

**✅ Status:** Order ID flows correctly through entire chain without renaming

---

## 🔒 Security Checks

### ✅ Signature Verification
- Uses `crypto.timingSafeEqual()` ✅
- Proper hex buffer comparison ✅
- HMAC format: `order_id + "|" + payment_id` ✅

### ✅ Replay Protection
- Checks `payments/${razorpay_payment_id}` before processing ✅
- Returns existing session if replay detected ✅

### ✅ Server-Side Validation
- Validates `coupleData` server-side ✅
- Amount determined from order data, not client ✅

---

## ⚠️ Recommendations

### 1. Add Environment Variable Validation
Add explicit check for test vs live keys:
```javascript
// In both create-order.js and verify-payment.js
const isTestKey = keyId?.startsWith('rzp_test_');
if (process.env.NODE_ENV === 'production' && isTestKey) {
  console.error('[Razorpay] PRODUCTION USING TEST KEY!');
  return res.status(500).json({ error: 'Configuration error.' });
}
```

### 2. Add Logging for Signature Failures
```javascript
if (!isValid) {
  console.error(`[Verify] Signature mismatch:`, {
    order_id: razorpay_order_id,
    payment_id: razorpay_payment_id,
    received_sig: razorpay_signature.substring(0, 10) + '...',
    expected_sig: expected.substring(0, 10) + '...',
  });
  return res.status(400).json({ verified: false, error: 'Payment verification failed.' });
}
```

### 3. Verify Environment Variables in Production
Run this check:
```bash
# In Vercel dashboard or CLI
vercel env ls
# Should show:
# - RAZORPAY_KEY_ID
# - RAZORPAY_KEY_SECRET
# - FIREBASE_DB_URL
# - FIREBASE_DB_SECRET
```

---

## ✅ Final Verdict

**Overall Status:** ✅ **INTEGRATION IS CORRECT**

**Key Points:**
1. ✅ Order ID flows correctly: `order.id` → `orderId` → `order_id` → `razorpay_order_id`
2. ✅ HMAC format is correct: `order_id + "|" + payment_id`
3. ✅ Signature verification uses timing-safe comparison
4. ✅ Error handling fails fast on missing secrets (correct behavior)
5. ⚠️ **ACTION REQUIRED:** Verify environment variables are set correctly in production
6. ⚠️ **ACTION REQUIRED:** Ensure both endpoints use same key pair (test or live)

**No code changes needed** - The integration is sound. Only configuration verification required.
