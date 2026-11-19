import { Request, Response } from 'express';

import {
  jsonDepth,
  MAX_JSON_DEPTH,
  rejectDeepJson,
} from '@core/middlewares/json-depth.middleware';

function nested(depth: number): unknown {
  let value: unknown = 1;
  for (let i = 0; i < depth; i++) value = [value];
  return value;
}

describe('rejectDeepJson', () => {
  it('measures depth without recursion, even very deep', () => {
    expect(jsonDepth({ a: { b: [1] } }, 10)).toBe(3);
    expect(jsonDepth(nested(100_000), MAX_JSON_DEPTH)).toBeGreaterThan(
      MAX_JSON_DEPTH,
    );
  });

  it('refuses a body nested too deep with a 400, and lets others through', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res = { status } as unknown as Response;
    const next = jest.fn();

    rejectDeepJson({ body: { query: '{ me { id } }' } } as Request, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    rejectDeepJson({ body: nested(1000) } as Request, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
