import { useMemo, useState, useEffect, useRef } from 'react';
import { CoupleData } from '../types';
import { LoaderState } from './useSharedLinkLoader';
import type { LoaderError, SharedLinkLoaderResult } from './useSharedLinkLoader';
import {
  extractSharePathSessionKey,
  deriveRecipientTitleHintFromSharePath,
  readCachedSessionPayload,
  writeCachedSessionPayload,
  clearCachedSessionPayload,
} from '../utils/sharePathHints';

function computePathLoaderSync(enabled: boolean): {
  pathRecipientTitleHint: string | null;
  initialState: LoaderState;
  initialData: CoupleData | null;
} {
  if (!enabled) {
    return {
      pathRecipientTitleHint: null,
      initialState: LoaderState.NO_LINK,
      initialData: null,
    };
  }
  const pathname =
    typeof window !== 'undefined' ? window.location.pathname : '/';
  const pathRecipientTitleHint =
    deriveRecipientTitleHintFromSharePath(pathname);
  const sessionKey = extractSharePathSessionKey(pathname);
  if (!sessionKey) {
    return {
      pathRecipientTitleHint,
      initialState: LoaderState.NO_LINK,
      initialData: null,
    };
  }
  const cached = readCachedSessionPayload(sessionKey);
  if (cached) {
    return {
      pathRecipientTitleHint,
      initialState: LoaderState.SUCCESS,
      initialData: cached,
    };
  }
  return {
    pathRecipientTitleHint,
    initialState: LoaderState.LOADING,
    initialData: null,
  };
}

/**
 * usePathLinkLoader
 *
 * Path URLs: /{senderSlug}-{recipientSlug}-{sessionKey}
 * - First paint can use sessionStorage cache (repeat opens).
 * - pathRecipientTitleHint is set for unambiguous three-segment paths while fetch runs.
 */
export function usePathLinkLoader(enabled: boolean): SharedLinkLoaderResult {
  const pathSyncModel = useMemo(
    () => computePathLoaderSync(enabled),
    [enabled]
  );

  const [state, setState] = useState<LoaderState>(pathSyncModel.initialState);
  const [data, setData] = useState<CoupleData | null>(pathSyncModel.initialData);
  const [error, setError] = useState<LoaderError | null>(null);

  const hasLoadedRef = useRef(false);

  const loadFromPath = async () => {
    if (!enabled) {
      setState(LoaderState.NO_LINK);
      return;
    }

    const sessionKey = extractSharePathSessionKey(window.location.pathname);
    if (!sessionKey) {
      setState(LoaderState.NO_LINK);
      return;
    }

    const hadCachedSuccess = readCachedSessionPayload(sessionKey) !== null;

    if (!hadCachedSuccess) {
      setState(LoaderState.LOADING);
      setError(null);
    }

    try {
      const response = await fetch('/api/load-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey }),
      });

      if (response.status === 400 || response.status === 404) {
        clearCachedSessionPayload(sessionKey);
        setError({
          code: 'VALIDATION_ERROR',
          message: 'This link has expired or does not exist.',
          recoverable: false,
        });
        setState(LoaderState.ERROR);
        setData(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load session.');
      }

      const sessionData = (await response.json()) as CoupleData | null;

      if (!sessionData) {
        clearCachedSessionPayload(sessionKey);
        setError({
          code: 'VALIDATION_ERROR',
          message: 'This link has expired or does not exist.',
          recoverable: false,
        });
        setState(LoaderState.ERROR);
        setData(null);
        return;
      }

      setData(sessionData);
      setState(LoaderState.SUCCESS);
      writeCachedSessionPayload(sessionKey, sessionData);
    } catch (err: unknown) {
      console.error('[PathLinkLoader] Error:', err);
      if (!hadCachedSuccess) {
        const message =
          err instanceof Error ? err.message : 'Failed to load session.';
        setError({
          code: 'UNKNOWN_ERROR',
          message,
          recoverable: true,
        });
        setState(LoaderState.ERROR);
      }
    }
  };

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void loadFromPath();
  }, []);

  return {
    state,
    data,
    error,
    retry: loadFromPath,
    pathRecipientTitleHint: pathSyncModel.pathRecipientTitleHint,
  };
}
