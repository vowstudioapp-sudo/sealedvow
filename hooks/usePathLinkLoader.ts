import { useState, useEffect, useRef } from 'react';
import { CoupleData } from '../types';
import { LoaderState } from './useSharedLinkLoader';
import type { LoaderError, SharedLinkLoaderResult } from './useSharedLinkLoader';

/**
 * usePathLinkLoader
 * 
 * Reads a session key from the URL pathname and fetches data via secure server proxy.
 * 
 * URL format: sealedvow.com/ajmal-saniya-k8f2x9m1
 * Extracts key: "k8f2x9m1" (last segment after final hyphen)
 * 
 * If `enabled` is false, immediately returns NO_LINK without fetching.
 * This prevents racing with the hash-based loader.
 */
export function usePathLinkLoader(enabled: boolean): SharedLinkLoaderResult {
  const [state, setState] = useState<LoaderState>(
    enabled ? LoaderState.IDLE : LoaderState.NO_LINK
  );
  const [data, setData] = useState<CoupleData | null>(null);
  const [error, setError] = useState<LoaderError | null>(null);

  const hasLoadedRef = useRef(false);

  const loadFromPath = async () => {
    if (!enabled) {
      setState(LoaderState.NO_LINK);
      return;
    }

    setState(LoaderState.LOADING);
    setError(null);

    try {
      // Extract path key from pathname
      // "/ajmal-saniya-k8f2x9m1" → "ajmal-saniya-k8f2x9m1"
      const pathname = window.location.pathname;
      const pathKey = pathname.replace(/^\//, '').replace(/\/$/, '');

      if (!pathKey) {
        setState(LoaderState.NO_LINK);
        return;
      }

      // Extract opaque key from slug if needed
      // "ajmal-saniya-k8f2x9m1" → last 8 chars = "k8f2x9m1"
      const parts = pathKey.split('-');
      const sessionKey = parts[parts.length - 1];

      if (!sessionKey || !/^[a-z0-9]{8}$/i.test(sessionKey)) {
        setState(LoaderState.NO_LINK);
        return;
      }

      // Fetch via secure server proxy
      const response = await fetch("/api/load-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });

      if (response.status === 400 || response.status === 404) {
        setError({
          code: 'VALIDATION_ERROR',
          message: 'This link has expired or does not exist.',
          recoverable: false,
        });
        setState(LoaderState.ERROR);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load session.");
      }

      const sessionData = await response.json();

      if (!sessionData) {
        setError({
          code: 'VALIDATION_ERROR',
          message: 'This link has expired or does not exist.',
          recoverable: false,
        });
        setState(LoaderState.ERROR);
        return;
      }

      setData(sessionData);
      setState(LoaderState.SUCCESS);

    } catch (err: any) {
      console.error('[PathLinkLoader] Error:', err);
      setError({
        code: 'UNKNOWN_ERROR',
        message: err.message || 'Failed to load session.',
        recoverable: true,
      });
      setState(LoaderState.ERROR);
    }
  };

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadFromPath();
  }, []);

  return {
    state,
    data,
    error,
    retry: loadFromPath,
  };
}