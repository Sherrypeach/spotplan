import { describe, expect, it } from 'vitest';

import { forwardedFor } from './vite.proxy';

describe('forwardedFor', () => {
  it('uses the real address of a browser that connects directly', () => {
    expect(forwardedFor(undefined, '203.0.113.7')).toBe('203.0.113.7');
  });

  it('ignores an address a browser made up', () => {
    expect(forwardedFor('1.2.3.4', '203.0.113.7')).toBe('203.0.113.7');
  });

  it('keeps the browser address the local tunnel reports', () => {
    expect(forwardedFor('198.51.100.9', '127.0.0.1')).toBe('198.51.100.9, 127.0.0.1');
    expect(forwardedFor('198.51.100.9', '::1')).toBe('198.51.100.9, ::1');
  });

  it('falls back to the peer when the tunnel sent nothing', () => {
    expect(forwardedFor(undefined, '127.0.0.1')).toBe('127.0.0.1');
  });
});
