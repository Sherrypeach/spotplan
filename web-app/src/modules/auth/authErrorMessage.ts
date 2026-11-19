import { apiErrorCode, isNetworkError } from '@shared/apiErrors';

const TOO_MANY_TRIES = 'Too many tries. Wait a few minutes, then try again.';
export const OFFLINE = 'We couldn’t reach the server. Check your connection and try again.';

/** Plain words for a failed sign-in or reset; `fallback` covers a plain "no". */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) return OFFLINE;
  if (apiErrorCode(error) === 'TOO_MANY_REQUESTS') return TOO_MANY_TRIES;
  return fallback;
}
