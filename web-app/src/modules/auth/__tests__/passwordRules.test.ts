import { describe, expect, it } from 'vitest';

import { passwordProblem } from '@modules/auth/passwordRules';

describe('passwordProblem', () => {
  it('asks for at least 8 characters', () => {
    expect(passwordProblem('a'.repeat(7))).toMatch(/at least 8/);
    expect(passwordProblem('a'.repeat(8))).toBeNull();
  });

  it('counts an emoji as one character', () => {
    expect(passwordProblem('🎉'.repeat(4))).toMatch(/at least 8/);
  });

  it('refuses more than 72 bytes, the most the server can check', () => {
    expect(passwordProblem('a'.repeat(72))).toBeNull();
    expect(passwordProblem('a'.repeat(73))).toMatch(/too long/);
  });

  it('measures the limit in bytes, so accented letters count double', () => {
    // 37 characters, 74 bytes.
    expect(passwordProblem('é'.repeat(37))).toMatch(/too long/);
  });
});
