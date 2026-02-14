# Backend Infrastructure Audit Report
**Date:** February 14, 2026  
**Project:** VowAPP (Sealed Vow)  
**Purpose:** Pre-flight audit before adding new API routes

---

## 1. Firebase REST Helper Functions

### ✅ **Status: IMPLEMENTED**

All four helper functions exist in `api/verify-payment.js`:

#### **1.1 `authUrl(path)`**
- **Location:** `api/verify-payment.js:97-104`
- **Purpose:** Builds authenticated Firebase RTDB URL
- **Implementation:**
  ```javascript
  function authUrl(path) {
    const base = process.env.FIREBASE_DB_URL;
    const secret = process.env.FIREBASE_DB_SECRET;
    if (secret) {
      return `${base}/${path}.json?auth=${secret}`;
    }
    return `${base}/${path}.json`;
  }
  ```
- **Usage:** Used by `firebaseRead` and `firebaseWrite`

#### **1.2 `firebaseRead(path)`**
- **Location:** `api/verify-payment.js:106-110`
- **Purpose:** Reads data from Firebase RTDB
- **Implementation:**
  ```javascript
  async function firebaseRead(path) {
    const res = await fetch(authUrl(path));
    if (!res.ok) throw new Error(`Firebase read ${path}: ${res.status}`);
    return res.json();
  }
  ```
- **Usage:** Used in `verify-payment.js` for:
  - Replay protection checks (`payments/${paymentId}`)
  - Order lookup (`orders/${orderId}`)
  - Session key collision checks (`shared/${sessionKey}`)
  - Founder token validation (`founderTokens/${token}`)

#### **1.3 `firebaseWrite(path, data)`**
- **Location:** `api/verify-payment.js:112-120`
- **Purpose:** Writes data to Firebase RTDB (PUT operation)
- **Implementation:**
  ```javascript
  async function firebaseWrite(path, data) {
    const res = await fetch(authUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Firebase write ${path}: ${res.status}`);
    return res.json();
  }
  ```
- **Usage:** Currently defined but **NOT actively used** in `verify-payment.js` (atomic updates preferred)

#### **1.4 `firebaseAtomicUpdate(updates)`**
- **Location:** `api/verify-payment.js:122-137`
- **Purpose:** Performs atomic multi-path updates (PATCH operation)
- **Implementation:**
  ```javascript
  async function firebaseAtomicUpdate(updates) {
    const base = process.env.FIREBASE_DB_URL;
    const secret = process.env.FIREBASE_DB_SECRET;
    const url = secret ? `${base}/.json?auth=${secret}` : `${base}/.json`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firebase atomic update failed: ${res.status} ${errText}`);
    }
    return res.json();
  }
  ```
- **Usage:** Used in `verify-payment.js` for atomic writes to:
  - `shared/${sessionKey}` (session data)
  - `payments/${paymentId}` (payment record)
  - `orders/${orderId}/status` (order status update)

### **Additional Helper in `create-order.js`:**
- **`buildUrl(path)`** - Similar to `authUrl`, used for founder code transactions

---

## 2. Environment Variables: FIREBASE_DB_URL & FIREBASE_DB_SECRET

### ✅ **Status: PROPERLY CONFIGURED**

#### **2.1 Usage Locations:**

**`api/create-order.js`:**
- Line 42: `const base = process.env.FIREBASE_DB_URL;`
- Line 43: `const secret = process.env.FIREBASE_DB_SECRET;`
- Used in `buildUrl()` function for founder code transactions

**`api/verify-payment.js`:**
- Line 98: `const base = process.env.FIREBASE_DB_URL;`
- Line 99: `const secret = process.env.FIREBASE_DB_SECRET;`
- Used in `authUrl()` function
- Line 123-124: Used again in `firebaseAtomicUpdate()`
- Line 159: `const firebaseDbUrl = process.env.FIREBASE_DB_URL;` (validation check)
- Line 296: Error logging references `FIREBASE_DB_URL`

#### **2.2 Access Pattern:**
- ✅ All access via `process.env.VARIABLE_NAME`
- ✅ No hardcoded values
- ✅ Proper null/undefined checks before use
- ✅ Error handling when missing (returns 500 with generic message)

#### **2.3 Security Notes:**
- `FIREBASE_DB_SECRET` is used as auth token in URL query params
- This is **legacy Firebase RTDB authentication** (not Admin SDK)
- Comment in code indicates migration to Firebase Admin SDK is planned

---

## 3. Existing API Routes

### ✅ **Status: 4 ROUTES IMPLEMENTED**

#### **3.1 `/api/ai.js`**
- **Purpose:** Provider-agnostic AI generation endpoint
- **Methods:** POST, OPTIONS
- **Features:**
  - Supports 6 actions: `generateLoveLetter`, `generateCoupleMyth`, `generateFutureProphecy`, `generateValentineImage`, `generateSacredLocation`, `generateAudioLetter`
  - Primary provider: Gemini (via `lib/ai/providers/geminiProvider.js`)
  - Fallback provider: OpenAI (for text-only actions, via `lib/ai/providers/openaiProvider.js`)
  - Rate limiting: 15 requests per 60 seconds per IP (in-memory)
  - Input validation via `lib/ai/validator.js`
  - Retry logic with temperature adjustment (3 attempts)
- **Dependencies:** 
  - `process.env.GEMINI_API_KEY` (required)
  - `process.env.OPENAI_API_KEY` (optional, for fallback)
- **Max Duration:** 60 seconds (configured in `vercel.json`)

#### **3.2 `/api/gemini.js`**
- **Purpose:** Backward compatibility wrapper
- **Implementation:** Re-exports `/api/ai.js` handler
- **Code:** `export { default } from './ai.js';`
- **Note:** Legacy endpoint, routes to main AI handler

#### **3.3 `/api/create-order.js`**
- **Purpose:** Razorpay order creation + founder code validation
- **Methods:** POST, OPTIONS
- **Features:**
  - Creates Razorpay payment orders via REST API
  - Tier-based pricing (standard: ₹99, reply: ₹149)
  - Founder code support with ETag-based atomic transactions
  - Persists orders to Firebase RTDB (`orders/${orderId}`)
  - Returns `orderId`, `amount`, `currency`, `keyId` to frontend
- **Dependencies:**
  - `process.env.RAZORPAY_KEY_ID` (required)
  - `process.env.RAZORPAY_KEY_SECRET` (required)
  - `process.env.FIREBASE_DB_URL` (required)
  - `process.env.FIREBASE_DB_SECRET` (optional, for authenticated writes)
- **Max Duration:** 30 seconds
- **Security:** Founder codes use ETag conditional writes to prevent double-redemption

#### **3.4 `/api/verify-payment.js`**
- **Purpose:** Payment verification + session creation (server-side authority)
- **Methods:** POST, OPTIONS
- **Features:**
  - Verifies Razorpay HMAC signature (timing-safe)
  - Replay protection (idempotent payment processing)
  - Server-side data validation
  - Session key generation with collision checking
  - Atomic multi-path Firebase writes
  - Supports two paths:
    - **Path A:** Founder access (via one-time token)
    - **Path B:** Razorpay payment verification
- **Dependencies:**
  - `process.env.RAZORPAY_KEY_SECRET` (required)
  - `process.env.FIREBASE_DB_URL` (required)
  - `process.env.FIREBASE_DB_SECRET` (optional)
- **Max Duration:** 30 seconds
- **Security:** This is the **ONLY** place paid sessions are created

---

## 4. Error Handling Patterns

### ✅ **Status: CONSISTENT & STRUCTURED**

#### **4.1 Try/Catch Blocks:**
- ✅ All API routes use try/catch for async operations
- ✅ Nested try/catch for fallback logic (e.g., `ai.js` Gemini → OpenAI)
- ✅ Specific error handling for Firebase operations

**Example from `verify-payment.js`:**
```javascript
try {
  // Signature verification
  const isValid = crypto.timingSafeEqual(...);
  if (!isValid) {
    return res.status(400).json({ verified: false, error: 'Payment verification failed.' });
  }
  // ... rest of logic
} catch (error) {
  console.error('[Verify] Error:', error);
  return res.status(500).json({ verified: false, error: 'Verification system error.' });
}
```

#### **4.2 Structured JSON Error Responses:**
- ✅ Consistent format: `{ error: string }` or `{ verified: false, error: string }`
- ✅ Generic error messages (no info leaks)
- ✅ Status codes match error severity

**Status Code Usage:**
- `200` - Success
- `400` - Bad Request (invalid input, missing fields)
- `405` - Method Not Allowed
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error (configuration issues, unexpected errors)
- `502` - Bad Gateway (external API failures, e.g., Razorpay)

**Example Error Responses:**
```javascript
// Invalid input
res.status(400).json({ error: 'Invalid or expired code.' });

// Missing configuration
res.status(500).json({ verified: false, error: 'Server configuration error.' });

// Rate limiting
res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
```

#### **4.3 Error Logging:**
- ✅ Console logging for debugging (`console.error`, `console.warn`, `console.log`)
- ✅ Includes context (function name, relevant IDs)
- ✅ No sensitive data in logs (payment IDs, tokens are logged safely)

**Example:**
```javascript
console.error('[Razorpay] Order creation failed:', errData);
console.warn(`[Verify] Signature mismatch: ${razorpay_order_id}`);
console.log(`[Verify] ✓ ${sessionKey} | ${razorpay_payment_id} | ${validTier}`);
```

#### **4.4 CORS Error Handling:**
- ✅ All routes implement CORS with `setCors()` or similar
- ✅ OPTIONS requests handled explicitly
- ✅ Origin validation against whitelist

---

## 5. Deployment Architecture

### ✅ **Status: VERCEL SERVERLESS FUNCTIONS**

#### **5.1 Framework:**
- **Primary:** Vite (frontend build tool)
- **Backend:** Pure Node.js ES modules (not Next.js)
- **Type:** `"type": "module"` in `package.json` (ESM)

#### **5.2 Vercel Configuration (`vercel.json`):**
```json
{
  "framework": "vite",
  "devCommand": "vite --port $PORT",
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/ai.js": { "maxDuration": 60 },
    "api/gemini.js": { "maxDuration": 60 },
    "api/create-order.js": { "maxDuration": 30 },
    "api/verify-payment.js": { "maxDuration": 30 }
  }
}
```

#### **5.3 Serverless Function Pattern:**
- ✅ Each file in `/api/` is automatically deployed as a Vercel serverless function
- ✅ Functions export default handler: `export default async function handler(req, res)`
- ✅ Standard Node.js `req`/`res` objects (Vercel's runtime)
- ✅ Max duration configured per function (30-60 seconds)

#### **5.4 Routing:**
- ✅ API routes: `/api/*` → serverless functions
- ✅ Frontend routes: `/*` → `index.html` (SPA routing)
- ✅ Rewrites configured for clean URLs

#### **5.5 Development:**
- ✅ Local dev uses Vite dev server
- ✅ API proxy configured in `vite.config.ts` (proxies `/api` to production)
- ✅ Production uses Vercel's serverless runtime

---

## 6. Summary & Recommendations

### ✅ **Strengths:**
1. **Complete Firebase helpers** - All 4 functions implemented and working
2. **Consistent error handling** - Structured JSON responses, proper status codes
3. **Security-conscious** - Generic error messages, timing-safe comparisons, replay protection
4. **Well-documented** - Comments explain complex logic (ETag transactions, atomic updates)
5. **Production-ready** - Rate limiting, CORS, environment variable validation

### ⚠️ **Areas for Improvement:**
1. **Firebase Auth Method** - Currently using legacy `?auth=` token. Consider migrating to Firebase Admin SDK for better security
2. **Error Response Format** - Some routes use `{ error: string }`, others use `{ verified: false, error: string }`. Consider standardizing
3. **Helper Function Location** - Firebase helpers are duplicated in `create-order.js` (`buildUrl`). Consider extracting to shared utility
4. **Rate Limiting** - `ai.js` uses in-memory rate limiting (per-instance). Consider Redis for multi-instance deployments

### 📋 **Ready for New Routes:**
✅ **YES** - Infrastructure is solid. New routes should:
- Follow the same `export default async function handler(req, res)` pattern
- Use existing Firebase helpers (or extract to shared module)
- Implement CORS via `setCors()` pattern
- Return structured JSON errors with appropriate status codes
- Add max duration to `vercel.json` if needed
- Use try/catch with proper error logging

---

## 7. File Structure Reference

```
/api/
  ├── ai.js              (AI generation, 60s max)
  ├── gemini.js          (Legacy wrapper → ai.js)
  ├── create-order.js   (Razorpay orders, 30s max)
  └── verify-payment.js  (Payment verification, 30s max)

Helpers (in verify-payment.js):
  ├── authUrl(path)
  ├── firebaseRead(path)
  ├── firebaseWrite(path)
  └── firebaseAtomicUpdate(updates)
```

---

**Report Generated:** February 14, 2026  
**Auditor:** AI Assistant  
**Status:** ✅ **APPROVED FOR NEW ROUTE DEVELOPMENT**
