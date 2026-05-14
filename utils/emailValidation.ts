// PR-49 C2 — email-shape validator lifted from SignInPromptModal.tsx:20-24
// before that file is deleted in C4. Regex preserved byte-identical so behavior
// is unchanged. The full email-validity check (deliverability, MX, etc.) is
// not performed client-side — this is a shape guard for inline form feedback.

export function isValidEmailShape(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}
