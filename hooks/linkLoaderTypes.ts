import { CoupleData } from '../types';

export enum LoaderState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  NO_LINK = 'NO_LINK',
  ERROR = 'ERROR',
}

export interface LoaderError {
  code: 'VALIDATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  recoverable: boolean;
}

export interface SharedLinkLoaderResult {
  state: LoaderState;
  data: CoupleData | null;
  error: LoaderError | null;
  retry: () => void;
  /** Title-case hint from /sender-recipient-key paths; null otherwise. */
  pathRecipientTitleHint: string | null;
}
