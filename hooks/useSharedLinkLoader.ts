import { useState, useEffect, useRef } from 'react';
import { CoupleData } from '../types';
import { extractPackageFromURL, secureDecodeBase64, DecodeError, DecodeErrorCode } from '../utils/secureDecoder';
import { validateCoupleData } from '../utils/validator';

/**
 * LOADER STATES
 * Different stages of loading a shared link
 */
export enum LoaderState {
  IDLE = 'IDLE',           // Not started yet
  LOADING = 'LOADING',     // Currently reading the link
  SUCCESS = 'SUCCESS',     // Link loaded successfully
  NO_LINK = 'NO_LINK',     // No link found (creator mode)
  ERROR = 'ERROR',         // Something went wrong
}

/**
 * ERROR INFORMATION
 * Details about what went wrong
 */
export interface LoaderError {
  code: DecodeErrorCode | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  recoverable: boolean; // Can the user retry?
}

/**
 * WHAT THIS HOOK RETURNS
 * The data and status you get back
 */
export interface SharedLinkLoaderResult {
  state: LoaderState;           // Current status
  data: CoupleData | null;      // The letter data (if successful)
  error: LoaderError | null;    // Error details (if failed)
  retry: () => void;            // Function to try again
}

/**
 * THE MAIN HOOK
 * This safely loads shared letter links from the URL
 * 
 * How to use:
 * const { state, data, error } = useSharedLinkLoader();
 */
export function useSharedLinkLoader(): SharedLinkLoaderResult {
  const [state, setState] = useState<LoaderState>(LoaderState.IDLE);
  const [data, setData] = useState<CoupleData | null>(null);
  const [error, setError] = useState<LoaderError | null>(null);
  
  // Track if we already loaded (prevent double-loading)
  const hasLoadedRef = useRef(false);
  
  // The function that does the actual loading
  const loadFromURL = () => {
    // Reset everything
    setState(LoaderState.LOADING);
    setError(null);
    
    try {
      // STEP 1: Get the link from the URL
      const packageData = extractPackageFromURL();
      
      // If no link found, this is creator mode (not an error)
      if (!packageData) {
        setState(LoaderState.NO_LINK);
        setData(null);
        return;
      }
      
      // STEP 2: Decode the link safely
      let decoded: unknown;
      try {
        decoded = secureDecodeBase64(packageData);
      } catch (err) {
        if (err instanceof DecodeError) {
          setError({
            code: err.code,
            message: err.message,
            recoverable: err.code !== DecodeErrorCode.URL_TOO_LARGE,
          });
        } else {
          setError({
            code: 'UNKNOWN_ERROR',
            message: 'Failed to read link',
            recoverable: true,
          });
        }
        setState(LoaderState.ERROR);
        return;
      }
      
      // STEP 3: Validate the data
      const validation = validateCoupleData(decoded);
      
      if (!validation.success || !validation.data) {
        setError({
          code: 'VALIDATION_ERROR',
          message: 'This link is corrupted or invalid',
          recoverable: false,
        });
        setState(LoaderState.ERROR);
        return;
      }
      
      // STEP 4: Success! We have valid data
      setData(validation.data);
      setState(LoaderState.SUCCESS);
      
    } catch (err) {
      // Unexpected error
      console.error('Unexpected error:', err);
      setError({
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong',
        recoverable: true,
      });
      setState(LoaderState.ERROR);
    }
  };
  
  // Load when the component first mounts
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadFromURL();
  }, []);
  
  // Return the results
  return {
    state,
    data,
    error,
    retry: loadFromURL,
  };
}