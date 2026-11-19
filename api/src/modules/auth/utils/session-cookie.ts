import { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'seating_session';

// HttpOnly so page scripts can never read the session; SameSite=Lax so other
// sites can't send it along with their own requests.
export function sessionCookieOptions(
  secure: boolean,
  maxAgeMs?: number,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** The session token from the request's cookie, if any. */
export function sessionFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[SESSION_COOKIE] ?? null;
}
