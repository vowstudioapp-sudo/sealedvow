/**
 * safeUrl — render-time defense-in-depth for user-controllable URLs.
 *
 * Returns the URL only if it parses as https:; otherwise returns '#' so
 * `<a href>` and `<iframe src>` attributes are inert.
 *
 * NOTE: server-side validation in /lib/coupleDataValidator.js enforces a
 * stricter host allowlist on writes (firebasestorage / archive.org / youtube /
 * google.com only). This helper is a final fallback at the render layer for
 * sites where attribute injection would matter (anchor href, iframe src). It
 * does NOT replace server-side validation — and intentionally permits any
 * https: host so legacy data with allowed-but-non-allowlisted hosts still
 * renders. The narrow goal is to block javascript:, data:, file:, and any
 * scheme that isn't https.
 */
export function safeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? url : '#';
  } catch {
    return '#';
  }
}
