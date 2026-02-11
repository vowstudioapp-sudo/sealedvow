import { useState } from 'react';
import { LoaderState } from './useSharedLinkLoader';
import type { SharedLinkLoaderResult } from './useSharedLinkLoader';
import { useSharedLinkLoader } from './useSharedLinkLoader';
import { usePathLinkLoader } from './usePathLinkLoader';

/**
 * Detect if the current URL has a path-based session key.
 * 
 * "/" → false (homepage, creation mode)
 * "/ajmal-saniya-k8f2x9m1" → true (receiver link)
 * "/#p=..." → false (old hash link, handled by useSharedLinkLoader)
 */
function detectPathKey(): boolean {
  const pathname = window.location.pathname;
  const cleaned = pathname.replace(/^\//, '').replace(/\/$/, '');
  return cleaned.length > 0
    && !cleaned.includes('.')
    && !cleaned.startsWith('__');
}

/**
 * useLinkLoader
 * 
 * Unified entry point for loading shared sessions.
 * Delegates to path-based loader (new clean URLs) or hash-based loader (legacy).
 * 
 * Detection runs once via useState initializer (not module scope).
 * Both hooks always execute (React rules). Only one is active.
 * Path takes absolute priority.
 */
export function useLinkLoader(): SharedLinkLoaderResult {
  // Computed once on first render. Stable across re-renders.
  const [pathMode] = useState<boolean>(() => detectPathKey());

  // Both hooks always execute. Only the active one does work.
  const pathResult = usePathLinkLoader(pathMode);
  const hashResult = useSharedLinkLoader(!pathMode);

  if (pathMode) {
    return pathResult;
  }

  return hashResult;
}

export { LoaderState };