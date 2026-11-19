import { BadRequestException } from '@nestjs/common';

// Shared by new accounts (CreateUserInput) and password resets, and matched by the web's forms.
// In its own file so the DTO can use it without pulling in the auth service.

/** bcrypt ignores everything past 72 bytes, so longer passwords are refused rather than silently cut short. */
export const MAX_PASSWORD_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 8;
// The longest address email allows; anything longer isn't an email.
export const MAX_EMAIL_LENGTH = 254;

/** Emails are stored and looked up trimmed and in lower case. */
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw new BadRequestException('That email is too long.');
  }
  return normalized;
}
