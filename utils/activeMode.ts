// /utils/activeMode.ts — Mode entry primitive for PR-49 dual-mode persistence.
//
// `sessionStorage.vday_mode` is routing-decision metadata, not persistence
// state. It records which persistence authority owns the current draft
// (guest = local storage, authenticated = cloud). Single write site in
// ModeSelectionModal; read by App.tsx hydration + dispatchers in Phase C.
//
// Survives refresh within a tab; auto-cleans on tab close.
//
// Phase A ships this in DORMANT form — only LandingPage writes it; no
// persistence-routing code reads it yet. Phase C wires the consumers.

const STORAGE_KEY = 'vday_mode';

export type ActiveMode = 'guest' | 'authenticated';

export function getActiveMode(): ActiveMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === 'guest' || raw === 'authenticated') return raw;
    return null;
  } catch {
    return null;
  }
}

export function setActiveMode(mode: ActiveMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // sessionStorage may be unavailable (private mode in some browsers,
    // quota errors). Mode write failure is non-fatal — Phase C dispatchers
    // treat absent mode as "show ModeSelectionModal at next Create click".
  }
}
