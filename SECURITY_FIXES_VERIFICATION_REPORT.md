# SECURITY FIXES VERIFICATION AUDIT
**Date:** February 15, 2026  
**Purpose:** Verify all previously implemented security fixes are present in current codebase

---

## ITEM 1: CORS Wildcard Removal
**Status:** ✅ **YES**

**File:** `api/create-order.js` (lines 24-35), `api/verify-payment.js` (lines 25-36), `api/ai.js` (lines 54-64)

**Code Proof:**
```javascript
const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app"
];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  // ... rest of CORS headers
}
```

**Notes:** Strict allowlist only. No `.endsWith('.vercel.app')` or wildcard matching found. Verified via grep search.

---

## ITEM 2: Firebase RTDB Rules - Public Read Removal
**Status:** ❌ **NO**

**File:** `database.rules.json` (lines 4-6)

**Code Proof:**
```json
"shared": {
  ".read": true,
  ".write": false
}
```

**Notes:** **CRITICAL - NOT FIXED.** The `shared` node still allows public read access. This is a security risk if session keys are leaked. However, since we now use server proxy (`/api/load-session`), direct RTDB access from client is blocked, but the rule itself is still permissive.

---

## ITEM 3: Firestore Rules Expiration Removal
**Status:** ✅ **YES**

**File:** `firestore.rules` (lines 1-13)

**Code Proof:**
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Firestore is not used in this application.
      // We use Firebase RTDB for sessions and Firebase Storage for media.
      // Deny all access to prevent accidental exposure and expiration issues.
      allow read, write: if false;
    }
  }
}
```

**Notes:** Fully locked. No expiration condition. All access denied.

---

## ITEM 4: AI Endpoint Distributed Rate Limiting
**Status:** ✅ **YES**

**File:** `api/ai.js` (lines 10-15, 275-295)

**Code Proof:**
```javascript
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ... later in handler ...

// ── DISTRIBUTED RATE LIMITING ──
try {
  const ip = getClientIP(req);
  const key = `ai_rate:${ip}`;

  const current = await kv.incr(key);

  if (current === 1) {
    await kv.expire(key, RATE_LIMIT_WINDOW);
  }

  if (current > MAX_REQUESTS) {
    return res.status(429).json({
      error: "Too many AI requests. Please wait a minute."
    });
  }
} catch (kvError) {
  console.error("[RateLimit] KV unavailable:", kvError.message);
  return res.status(503).json({
    error: "Service temporarily unavailable. Please try again."
  });
}
```

**Notes:** Uses Redis (`@upstash/redis`), not in-memory Map. No `rateLimitMap` found.

---

## ITEM 5: create-order.js Distributed Rate Limiting
**Status:** ✅ **YES**

**File:** `api/create-order.js` (lines 7-12, 132-155)

**Code Proof:**
```javascript
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ... later in handler ...

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

**Notes:** Distributed rate limiting implemented. 5 requests per 60 seconds per IP.

---

## ITEM 6: verify-payment.js Distributed Rate Limiting
**Status:** ✅ **YES**

**File:** `api/verify-payment.js` (lines 2-7, 164-187)

**Code Proof:**
```javascript
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ... later in handler ...

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

**Notes:** Distributed rate limiting implemented. 5 requests per 60 seconds per IP.

---

## ITEM 7: load-session.js Distributed Rate Limiting
**Status:** ✅ **YES**

**File:** `api/load-session.js` (lines 8-13, 106-130)

**Code Proof:**
```javascript
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ... later in handler ...

// ── SESSION LOAD RATE LIMITING ──
const RATE_LIMIT_WINDOW = 60; // seconds
const MAX_REQUESTS = 10; // per IP per minute

try {
  const ip = getClientIP(req);
  const key = `session_load_rate:${ip}`;
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
  console.error("[SessionRateLimit] KV unavailable:", kvError.message);
  return res.status(503).json({
    error: "Service temporarily unavailable. Please try again."
  });
}
```

**Notes:** Distributed rate limiting implemented. 10 requests per 60 seconds per IP.

---

## ITEM 8: load-session.js Sanitization
**Status:** ✅ **YES**

**File:** `api/load-session.js` (lines 62-92, 160)

**Code Proof:**
```javascript
function sanitizeSession(data = {}) {
  return {
    senderName: data.senderName,
    recipientName: data.recipientName,
    finalLetter: data.finalLetter,
    myth: data.myth,
    timeShared: data.timeShared,
    occasion: data.occasion,
    theme: data.theme,
    sealedAt: data.sealedAt,
    createdAt: data.createdAt,
    revealMethod: data.revealMethod,
    unlockDate: data.unlockDate,
    userImageUrl: data.userImageUrl,
    aiImageUrl: data.aiImageUrl,
    video: data.video,
    videoSource: data.videoSource,
    audio: data.audio,
    musicUrl: data.musicUrl,
    musicType: data.musicType,
    memoryBoard: data.memoryBoard,
    sacredLocation: data.sacredLocation,
    coupons: data.coupons,
    hasGift: data.hasGift,
    giftTitle: data.giftTitle,
    giftNote: data.giftNote,
    giftLink: data.giftLink,
    replyEnabled: data.replyEnabled,
    sessionId: data.sessionId,
  };
}

// ... later in handler ...

// ── RETURN SESSION DATA ──
return res.status(200).json(sanitizeSession(sessionData));
```

**Notes:** `sanitizeSession()` function exists and is used. Does NOT return raw `sessionData`.

---

## ITEM 9: usePathLinkLoader Server Proxy
**Status:** ✅ **YES**

**File:** `hooks/usePathLinkLoader.ts` (lines 56-77)

**Code Proof:**
```typescript
// Fetch via secure server proxy
const response = await fetch("/api/load-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionKey }),
});

if (response.status === 400 || response.status === 404) {
  setError({
    code: 'VALIDATION_ERROR',
    message: 'This link has expired or does not exist.',
    recoverable: false,
  });
  setState(LoaderState.ERROR);
  return;
}

if (!response.ok) {
  throw new Error("Failed to load session.");
}

const sessionData = await response.json();
```

**Notes:** Uses `/api/load-session` proxy. No direct Firebase RTDB reads. No `loadSession` import from `services/firebase`.

---

## ITEM 10: Exit Overlay Timestamp Uses Stored sealedAt
**Status:** ✅ **YES**

**File:** `components/MainExperience.tsx` (lines 251-257, 1623-1633)

**Code Proof:**
```typescript
// Derive sealed date once — validated and memoized
const sealedDate = useMemo(() => {
  if (!data.sealedAt && !data.createdAt) return null;
  const raw = data.sealedAt || data.createdAt;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}, [data.sealedAt, data.createdAt]);

// ... later in exit overlay ...

{sealedDate && (
  <div style={{ color: theme.gold, opacity: 0.2 }}>
    <p className="text-[8px] uppercase tracking-[0.3em] mb-1">Sealed on</p>
    <p className="text-[10px] font-bold tracking-[0.15em]">
      {sealedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
    <p className="text-[9px] tracking-[0.1em] mt-0.5">
      {sealedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST
    </p>
  </div>
)}
```

**Notes:** Uses `sealedDate` derived from `data.sealedAt || data.createdAt`. No `new Date()` in exit overlay for actual receivers.

---

## ITEM 11: Founder Code Brute-Force Limiter
**Status:** ✅ **YES**

**File:** `api/create-order.js` (lines 164-184, 192-210)

**Code Proof:**
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

**Notes:** Implemented in two places: before invalid format check (line 164) and before invalid/expired code return (line 192). 10 attempts per hour (3600 seconds) per IP.

---

## ITEM 12: @vercel/kv No Longer Used
**Status:** ✅ **YES**

**File:** All API files

**Code Proof:**
```bash
# Grep result:
No matches found
```

**Notes:** Verified via grep search. All files now use `@upstash/redis` instead of `@vercel/kv`.

---

## ITEM 13: Firestore Rules Fully Locked
**Status:** ✅ **YES**

**File:** `firestore.rules` (lines 1-13)

**Code Proof:**
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Firestore is not used in this application.
      // We use Firebase RTDB for sessions and Firebase Storage for media.
      // Deny all access to prevent accidental exposure and expiration issues.
      allow read, write: if false;
    }
  }
}
```

**Notes:** Fully locked. All read and write access denied. No expiration conditions.

---

## SUMMARY

**Fixed:** 12/13 items ✅  
**Not Fixed:** 1/13 items ❌

### Critical Issue Remaining:

**ITEM 2: Firebase RTDB Rules** - Still allows public read on `shared` node.

**Recommendation:** While the server proxy (`/api/load-session`) prevents direct client access, the RTDB rule should still be tightened for defense-in-depth. Consider:
- Requiring authentication for reads
- Using signed URLs
- Or at minimum, documenting that this is acceptable because client access is blocked by server proxy

---

**Report End**
