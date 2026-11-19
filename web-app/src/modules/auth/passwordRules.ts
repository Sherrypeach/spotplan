import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@shared/serverLimits';

export { MIN_PASSWORD_LENGTH };

/** What's wrong with a new password, in plain words, or null when it's fine. */
export function passwordProblem(password: string): string | null {
  // Count characters as people see them, so an emoji counts once.
  const characters = [...password].length;
  if (characters < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'That password is too long. Use a shorter one.';
  }
  return null;
}
