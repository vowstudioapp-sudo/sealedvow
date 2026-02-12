# Final Launch Fix — Server-Side Payment Authority

## What This Fixes

**Before:** Client calls `saveSession()` → anyone creates free sessions from DevTools.
**After:** Server creates session only after verified Razorpay payment → impossible to bypass.

---

## All Files (7 total)

| File | Action | What It Does |
|------|--------|-------------|
| `api/verify-payment.js` | **REPLACE** | Verifies payment + creates session server-side (atomic write) |
| `api/create-order.js` | **REPLACE** | Same logic + auth token on RTDB write |
| `components/PaymentStage.tsx` | **REPLACE** | Sends coupleData to server, receives shareSlug back |
| `components/SharePackage.tsx` | **REPLACE** | Pure display — no saveSession, no DB writes |
| `components/ReceiverErrorBoundary.tsx` | **NEW** | Catches render crashes, shows fallback |
| `APP_TSX_PATCH_GUIDE.ts` | **REFERENCE** | 4 surgical changes to App.tsx |
| `database.rules.json` | **NEW** | Locked RTDB rules — deploy LAST |

---

## Deployment Steps

### Step 0: Add Environment Variable
Go to **Vercel Dashboard → Project → Settings → Environment Variables**.
Add:
```
FIREBASE_DB_SECRET = (your database secret)
```
Get this from: **Firebase Console → Project Settings → Service Accounts → Database Secrets**

This is required. Without it, RTDB writes will fail after rules are locked.

### Step 1: Replace API Files
```
cp api/verify-payment.js   → your-repo/api/verify-payment.js
cp api/create-order.js     → your-repo/api/create-order.js
```

### Step 2: Replace Component Files
```
cp components/PaymentStage.tsx          → your-repo/components/PaymentStage.tsx
cp components/SharePackage.tsx          → your-repo/components/SharePackage.tsx
cp components/ReceiverErrorBoundary.tsx → your-repo/components/ReceiverErrorBoundary.tsx
```

### Step 3: Patch App.tsx (4 changes)
Follow `APP_TSX_PATCH_GUIDE.ts`. Summary:
1. Add `sessionKey` and `shareSlug` state variables
2. Update `PaymentStage` `onPaymentComplete` callback to accept `{ replyEnabled, sessionKey, shareSlug }`
3. Pass `sessionKey` and `shareSlug` as props to `SharePackage`
4. (Optional) Wrap receiver stages with `<ReceiverErrorBoundary>`

### Step 4: Deploy to Vercel Preview
```
git add -A && git commit -m "fix: server-side session authority" && git push
```

### Step 5: Test (ALL must pass)
1. Full Razorpay test payment → session created in RTDB `/shared/`? **YES**
2. Share page shows correct URL? **YES**
3. Receiver link loads correctly? **YES**
4. Same payment ID retried → returns existing session (no duplicate)? **YES**
5. Open DevTools → can you create a session without paying? **NO** ← this is the fix

### Step 6: Deploy RTDB Rules (ONLY after Step 5 passes)
Paste `database.rules.json` into Firebase Console → Realtime Database → Rules → Publish.

### Step 7: Test Again After Rules
1. Full Razorpay test payment still works? **YES**
2. Receiver link still loads? **YES**

If yes → push to production.

---

## Post-Launch (Week 1)
- Migrate from `FIREBASE_DB_SECRET` (legacy) to Firebase Admin SDK (proper)
- Tighten `/sessions/$id/sync` write rules
- Add server-side rate limiting (Vercel KV or Firebase counter)
- Decompose large components