import { useState } from 'react';
import { LoaderState } from './linkLoaderTypes';
import type { SharedLinkLoaderResult } from './linkLoaderTypes';
import { usePathLinkLoader } from './usePathLinkLoader';

/**
 * Detect if the current URL has a path-based session key.
 *
 * "/" → false (homepage, creation mode)
 * "/ajmal-saniya-k8f2x9m1" → true (receiver link — single path segment)
 * "/letter/create" → false (creator route — multiple segments)
 */
function detectPathKey(): boolean {
  const pathname = window.location.pathname;
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments.length !== 1) return false;
  const cleaned = segments[0];
  return (
    cleaned.length > 0 &&
    !cleaned.includes('.') &&
    !cleaned.startsWith('__')
  );
}

/**
 * useLinkLoader
 *
 * Unified entry point for loading shared sessions.
 * Path mode → fetch session via path key. Otherwise → creator/no-link mode.
 *
 * Detection runs once via useState initializer (not module scope).
 */
export function useLinkLoader(): SharedLinkLoaderResult {
  const [pathMode] = useState<boolean>(() => detectPathKey());
  return usePathLinkLoader(pathMode);
}

export { LoaderState };
