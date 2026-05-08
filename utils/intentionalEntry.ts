// Sentinel that survives a single SPA navigation. Set by "begin a fresh
// letter" entry points (landing CTA, occasion selector cards), consumed
// by PreparationForm on mount to decide whether to show the resume modal.
//
// sessionStorage (not localStorage) so it doesn't outlive the tab.
// Clear-on-read so accidental re-mounts don't keep replaying it.

const ENTRY_FLAG_KEY = 'sv_intentional_entry';

export function markIntentionalEntry(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ENTRY_FLAG_KEY, '1');
  } catch (err) {
    console.warn('[intentionalEntry] markIntentionalEntry failed:', err);
  }
}

export function consumeIntentionalEntry(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const flag = window.sessionStorage.getItem(ENTRY_FLAG_KEY);
    window.sessionStorage.removeItem(ENTRY_FLAG_KEY);
    return flag === '1';
  } catch (err) {
    console.warn('[intentionalEntry] consumeIntentionalEntry failed:', err);
    return false;
  }
}
