// ─────────────────────────────────────────────
// SealedVow — Feature Flags
// Central on/off switches for all features.
// Object.freeze prevents runtime mutation.
// ─────────────────────────────────────────────

export const FEATURES = Object.freeze({

  // ── Existing ──────────────────────────────
  replyTierEnabled: false,

  // ── Eidi MVP (Eid 2026) ───────────────────
  eidiEnabled: true,              // Master switch — show/hide all Eidi entry points

  // ── Phase 2 (Eid ul-Adha / later) ────────
  eidiRealMoneyEnabled: false,    // Real UPI payout after reveal
  eidiFamilyRoomEnabled: false,   // Multiple elders contribute
  eidiVaultEnabled: false,        // Yearly Eidi memory vault

} as const);

export type FeatureKey = keyof typeof FEATURES;
