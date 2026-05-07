// ─────────────────────────────────────────────
// SealedVow — Feature Flags
// Central on/off switches for all features.
// Object.freeze prevents runtime mutation.
// ─────────────────────────────────────────────

export const FEATURES = Object.freeze({

  // ── Eidi MVP (Eid 2026) ───────────────────
  eidiEnabled: false,             // Master switch — show/hide all Eidi entry points

  // ── Phase 2 (Eid ul-Adha / later) ────────
  eidiRealMoneyEnabled: false,    // Real UPI payout after reveal
  eidiFamilyRoomEnabled: false,   // Multiple elders contribute
  eidiVaultEnabled: false,        // Yearly Eidi memory vault

  // ── Ritual selection (sender Step 3) ──────
  ritualsEnabled: false,          // Hides the "Choose Your Ritual" block at PreparationForm Step 3

} as const);

export type FeatureKey = keyof typeof FEATURES;
