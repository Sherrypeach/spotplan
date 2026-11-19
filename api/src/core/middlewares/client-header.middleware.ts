import { NextFunction, Request, Response } from 'express';

export const CLIENT_HEADER = 'x-seating-client';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Every write must carry a custom header. Browsers can't add one to a request
 * from another site unless CORS allows it, and it never does, so a page
 * elsewhere can't act with a teacher's session cookie.
 */
export function requireClientHeader(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method) || req.header(CLIENT_HEADER)) {
    next();
    return;
  }
  res.status(403).json({ statusCode: 403, message: 'Missing client header' });
}
