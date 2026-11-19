import { NextFunction, Request, Response } from 'express';

// A whole class nests about ten levels deep inside a GraphQL request; nothing
// legitimate comes near this.
export const MAX_JSON_DEPTH = 32;

/** How deep `value` nests, counted without recursion so a hostile body can't overflow the stack. */
export function jsonDepth(value: unknown, stopAt: number): number {
  let deepest = 0;
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  while (stack.length > 0) {
    const { value: current, depth } = stack.pop()!;
    if (current === null || typeof current !== 'object') continue;
    const level = depth + 1;
    deepest = Math.max(deepest, level);
    if (deepest > stopAt) return deepest;
    for (const child of Object.values(current)) {
      stack.push({ value: child, depth: level });
    }
  }
  return deepest;
}

/**
 * Refuses bodies nested absurdly deep before anything walks them recursively
 * (validation, JSON.stringify), which would otherwise crash with a stack
 * overflow and answer 500 instead of 400.
 */
export function rejectDeepJson(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (jsonDepth(req.body, MAX_JSON_DEPTH) > MAX_JSON_DEPTH) {
    res
      .status(400)
      .json({ statusCode: 400, message: 'The request could not be read.' });
    return;
  }
  next();
}
