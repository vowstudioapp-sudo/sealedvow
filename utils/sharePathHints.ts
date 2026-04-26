import type { CoupleData } from '../types';

const SESSION_CACHE_PREFIX = 'sv_sess_cache_v1:';

function normalizePathKey(pathname: string): string {
  return pathname.replace(/^\//, '').replace(/\/$/, '');
}

export function extractSharePathSessionKey(pathname: string): string | null {
  const pathKey = normalizePathKey(pathname);
  if (!pathKey) return null;
  const parts = pathKey.split('-');
  const sessionKey = parts[parts.length - 1];
  if (!sessionKey || !/^[a-z0-9]{8}$/i.test(sessionKey)) return null;
  return sessionKey;
}

/**
 * Share URLs are `${slugify(sender)}-${slugify(recipient)}-${sessionKey}`.
 * When the path has exactly three segments, the middle segment is the full
 * recipient slug (slugify collapses spaces to single hyphens within one name).
 */
export function deriveRecipientTitleHintFromSharePath(pathname: string): string | null {
  const pathKey = normalizePathKey(pathname);
  if (!pathKey) return null;
  const parts = pathKey.split('-');
  if (parts.length !== 3) return null;
  const sessionKey = parts[2];
  if (!/^[a-z0-9]{8}$/i.test(sessionKey)) return null;
  const recipientSlug = parts[1];
  if (!recipientSlug) return null;
  return recipientSlug
    .split('-')
    .map((w) =>
      w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ');
}

function sessionCacheKey(sessionKey: string): string {
  return `${SESSION_CACHE_PREFIX}${sessionKey}`;
}

export function readCachedSessionPayload(sessionKey: string): CoupleData | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(sessionCacheKey(sessionKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.recipientName !== 'string' || !o.recipientName.trim()) return null;
    if (typeof o.senderName !== 'string' || !o.senderName.trim()) return null;
    const theme =
      o.theme === 'obsidian' ||
      o.theme === 'velvet' ||
      o.theme === 'crimson' ||
      o.theme === 'midnight' ||
      o.theme === 'evergreen' ||
      o.theme === 'pearl'
        ? o.theme
        : 'obsidian';
    return { ...(o as unknown as CoupleData), theme };
  } catch {
    return null;
  }
}

export function writeCachedSessionPayload(sessionKey: string, payload: CoupleData): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(sessionCacheKey(sessionKey), JSON.stringify(payload));
  } catch {
    /* quota or private mode */
  }
}

export function clearCachedSessionPayload(sessionKey: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(sessionCacheKey(sessionKey));
  } catch {
    /* ignore */
  }
}
