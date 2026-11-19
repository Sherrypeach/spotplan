import { createHmac } from 'crypto';

export const JWT_ALGORITHM = 'HS256';

/** What a token is for; each kind is signed with its own key. */
export type TokenAudience = 'session' | 'reset';

/**
 * A separate key per kind of token, derived from the one configured secret, so
 * a reset token can never pass as a session (or any future kind) even where a
 * check on `type` were missing.
 */
export function tokenSecret(secret: string, audience: TokenAudience): string {
  return createHmac('sha256', secret)
    .update(`seating:${audience}`)
    .digest('hex');
}
