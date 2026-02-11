import { SECURITY_LIMITS } from './validator';
/**
 * ERROR TYPES
 * Different kinds of problems that can happen when reading a link
 */
export enum DecodeErrorCode {
  URL_TOO_LARGE = 'URL_TOO_LARGE',      // Link is too big
  INVALID_FORMAT = 'INVALID_FORMAT',     // Link is broken
  DECODE_FAILED = 'DECODE_FAILED',       // Can't read the link
  INVALID_JSON = 'INVALID_JSON',         // Data is corrupted
}

/**
 * ERROR CLASS
 * When something goes wrong, we create this object
 */
export class DecodeError extends Error {
  constructor(
    public code: DecodeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'DecodeError';
  }
}

/**
 * SAFE DECODER
 * This is the function that safely reads shared links
 */
export function secureDecodeBase64(encodedData: string): unknown {
  // Step 1: Check if the link is too big (prevent crashes)
  if (encodedData.length > SECURITY_LIMITS.MAX_TEXT_LENGTH) {
    throw new DecodeError(
      DecodeErrorCode.URL_TOO_LARGE,
      'This link is too large or corrupted'
    );
  }
  
  // Step 2: Decode the URL
  let decodedUri: string;
  try {
    decodedUri = decodeURIComponent(encodedData);
  } catch (error) {
    throw new DecodeError(
      DecodeErrorCode.INVALID_FORMAT,
      'This link is not formatted correctly'
    );
  }
  
  // Step 3: Decode base64
  let binaryString: string;
  try {
    binaryString = atob(decodedUri);
  } catch (error) {
    throw new DecodeError(
      DecodeErrorCode.DECODE_FAILED,
      'Failed to read link data'
    );
  }
  
  // Step 4: Convert to text
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  let jsonString: string;
  try {
    jsonString = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new DecodeError(
      DecodeErrorCode.DECODE_FAILED,
      'Link data is corrupted'
    );
  }
  
  // Step 5: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new DecodeError(
      DecodeErrorCode.INVALID_JSON,
      'Link data is not valid'
    );
  }
  
  return parsed;
}

/**
 * GET LINK FROM URL
 * Looks for the shared link in the browser address bar
 */
export function extractPackageFromURL(): string | null {
  // Check query params (?p=...)
  const queryParams = new URLSearchParams(window.location.search);
  let packageData = queryParams.get('p');
  
  // If not found, check hash (#p=...)
  if (!packageData && window.location.hash) {
    const hashMatch = window.location.hash.match(/[#&]p=([^&]+)/);
    if (hashMatch) {
      packageData = hashMatch[1];
    }
  }
  
  return packageData;
}