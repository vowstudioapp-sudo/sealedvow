# TIMESTAMP INCONSISTENCY ANALYSIS REPORT
**Date:** February 15, 2026  
**Issue:** "Sealed on" timestamp showing current date instead of stored `sealedAt` value

---

## EXECUTIVE SUMMARY

Found **2 locations** in `components/MainExperience.tsx` that use `new Date()` instead of stored session data:
1. **Line 1624-1627** — Exit overlay "Sealed on" section (CRITICAL — affects actual receivers)
2. **Line 1329-1331** — Reply sealed confirmation timestamp (QUESTIONABLE — may be intentional)

Found **2 locations** that correctly use stored data:
1. **Line 1127-1138** — Final closure section (CORRECT)
2. **Line 1552-1558** — Exit overlay for preview/demo mode (CORRECT)

---

## DETAILED FINDINGS

### ✅ CORRECT USAGE #1: Final Closure Section

**File:** `components/MainExperience.tsx`  
**Lines:** 1127-1138  
**Context:** Final closure section (main experience, not exit overlay)

**Code:**
```tsx
{(data.sealedAt || data.createdAt) && (
  <p 
    className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold"
    style={{ color: theme.gold, opacity: 0.6, animation: 'closureReveal 1s ease-out 1s both' }}
  >
    {(() => {
      const d = new Date(data.sealedAt || data.createdAt || '');
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        + ' · '
        + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    })()}
  </p>
)}
```

**Status:** ✅ **CORRECT**
- Uses `data.sealedAt || data.createdAt`
- Parses stored timestamp correctly
- Formats appropriately

---

### ✅ CORRECT USAGE #2: Exit Overlay (Preview/Demo Mode)

**File:** `components/MainExperience.tsx`  
**Lines:** 1552-1558  
**Context:** Exit overlay seal block (only shown for preview and demo mode)

**Code:**
```tsx
{(data.sealedAt || data.createdAt) && (
  <p className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: theme.gold, opacity: 0.6 }}>
    {(() => {
      const d = new Date(data.sealedAt || data.createdAt || '');
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    })()}
  </p>
)}
```

**Status:** ✅ **CORRECT**
- Uses `data.sealedAt || data.createdAt`
- Only shown for preview/demo (line 1544 condition)
- Actual receivers skip this block

---

### ❌ INCORRECT USAGE #1: Exit Overlay "Sealed on" (Actual Receivers)

**File:** `components/MainExperience.tsx`  
**Lines:** 1622-1628  
**Context:** Exit overlay closure section for **actual receivers** (not preview/demo)

**Code:**
```tsx
<div style={{ color: theme.gold, opacity: 0.2 }}>
  <p className="text-[8px] uppercase tracking-[0.3em] mb-1">Sealed on</p>
  <p className="text-[10px] font-bold tracking-[0.15em]">
    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
  </p>
  <p className="text-[9px] tracking-[0.1em] mt-0.5">
    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST
  </p>
</div>
```

**Status:** ❌ **INCORRECT**
- Uses `new Date()` instead of `data.sealedAt || data.createdAt`
- Shows **current date/time** instead of original sealed timestamp
- This is the **PRIMARY ISSUE** affecting actual receivers

**Context:**
- Located in exit overlay (line 1408: `{showExitOverlay && (`)
- Only shown for actual receivers (line 1605: `else` branch, not preview/demo)
- Displays "Sealed by {senderName}" followed by "Sealed on" timestamp

---

### ⚠️ QUESTIONABLE USAGE: Reply Sealed Confirmation

**File:** `components/MainExperience.tsx`  
**Lines:** 1329-1331  
**Context:** Reply sealed confirmation overlay (after user seals a reply)

**Code:**
```tsx
<p 
  className="text-[10px] uppercase tracking-[0.3em] font-bold"
  style={{ color: theme.gold, opacity: 0.6, animation: 'closureReveal 0.8s ease-out 2s both' }}
>
  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  {' · '}
  {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
</p>
```

**Status:** ⚠️ **QUESTIONABLE** (May be intentional)
- Uses `new Date()` to show when the **reply** was sealed
- This is different from the original vow's `sealedAt`
- If reply timestamps are stored separately, this should use that value
- If replies don't have stored timestamps, current behavior may be acceptable

**Note:** This is NOT the issue described by the user (which is about the original vow's "Sealed on" timestamp).

---

## SUMMARY TABLE

| Location | Lines | Context | Uses Stored Data? | Status |
|---------|-------|---------|-------------------|--------|
| Final Closure | 1127-1138 | Main experience ending | ✅ Yes (`data.sealedAt \|\| data.createdAt`) | ✅ CORRECT |
| Exit Overlay (Preview) | 1552-1558 | Exit overlay for preview/demo | ✅ Yes (`data.sealedAt \|\| data.createdAt`) | ✅ CORRECT |
| Exit Overlay (Receivers) | 1622-1628 | Exit overlay for actual receivers | ❌ No (`new Date()`) | ❌ **INCORRECT** |
| Reply Confirmation | 1329-1331 | Reply sealed confirmation | ⚠️ No (`new Date()`) | ⚠️ QUESTIONABLE |

---

## ROOT CAUSE

The exit overlay for actual receivers (lines 1605-1632) has a separate "Sealed on" section that was implemented independently from the preview/demo version. The preview version correctly uses stored data (lines 1552-1558), but the actual receiver version (lines 1622-1628) was implemented with `new Date()`, causing it to show the current date instead of the original sealed timestamp.

---

## PROPOSED FIX

### Fix #1: Exit Overlay "Sealed on" (CRITICAL)

**File:** `components/MainExperience.tsx`  
**Lines:** 1622-1628  
**Change:** Replace `new Date()` with stored timestamp

**Current Code:**
```tsx
<div style={{ color: theme.gold, opacity: 0.2 }}>
  <p className="text-[8px] uppercase tracking-[0.3em] mb-1">Sealed on</p>
  <p className="text-[10px] font-bold tracking-[0.15em]">
    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
  </p>
  <p className="text-[9px] tracking-[0.1em] mt-0.5">
    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST
  </p>
</div>
```

**Proposed Fix:**
```tsx
{(data.sealedAt || data.createdAt) && (
  <div style={{ color: theme.gold, opacity: 0.2 }}>
    <p className="text-[8px] uppercase tracking-[0.3em] mb-1">Sealed on</p>
    <p className="text-[10px] font-bold tracking-[0.15em]">
      {(() => {
        const d = new Date(data.sealedAt || data.createdAt || '');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      })()}
    </p>
    <p className="text-[9px] tracking-[0.1em] mt-0.5">
      {(() => {
        const d = new Date(data.sealedAt || data.createdAt || '');
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      })()} IST
    </p>
  </div>
)}
```

**Changes:**
1. Wrap in conditional: `{(data.sealedAt || data.createdAt) && (`
2. Replace both `new Date()` calls with `new Date(data.sealedAt || data.createdAt || '')`
3. Maintain same formatting (en-IN locale, IST timezone)
4. Preserve existing styling and structure

---

### Fix #2: Reply Sealed Confirmation (OPTIONAL)

**File:** `components/MainExperience.tsx`  
**Lines:** 1329-1331  
**Status:** Only fix if reply timestamps are stored in database

**If replies have stored timestamps:**
- Check if `data.replySealedAt` or similar field exists
- Replace `new Date()` with stored reply timestamp
- If no stored timestamp exists, current behavior (showing current time) may be acceptable

**Note:** This is separate from the main issue and may require backend changes to store reply timestamps.

---

## VERIFICATION CHECKLIST

After applying Fix #1:

- [ ] Exit overlay for actual receivers shows original `sealedAt` timestamp
- [ ] Preview/demo mode continues to work correctly
- [ ] Final closure section unchanged (already correct)
- [ ] No breaking changes to other timestamp displays
- [ ] Formatting matches existing style (en-IN locale, IST timezone)

---

## FILES TO MODIFY

**Only 1 file needs modification:**
- `components/MainExperience.tsx` (lines 1622-1628)

**No other files need changes.**

---

## ADDITIONAL NOTES

1. **Database Storage:** Confirmed that `sealedAt` is correctly stored in `api/verify-payment.js` (lines 276, 419) using `new Date().toISOString()`.

2. **Data Flow:** The `sealedAt` value flows correctly from:
   - `api/verify-payment.js` → Firebase → `api/load-session.js` → `hooks/usePathLinkLoader.ts` → `App.tsx` → `MainExperience.tsx`

3. **Locale Consistency:** The exit overlay uses `en-IN` locale while other sections use `en-US`. This is intentional (IST timezone display), but the fix should maintain this locale choice.

4. **Conditional Rendering:** The exit overlay "Sealed on" section should only render if `data.sealedAt || data.createdAt` exists, matching the pattern used in other sections.

---

**Report End**
