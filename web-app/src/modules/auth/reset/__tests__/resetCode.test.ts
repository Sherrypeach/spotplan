import { describe, expect, it } from 'vitest';

import { cleanCode } from '@modules/auth/reset/resetCode';

describe('cleanCode', () => {
  it('keeps a pasted code with a space in it', () => {
    expect(cleanCode('123 456')).toBe('123456');
  });

  it('drops letters and stops at 6 digits', () => {
    expect(cleanCode('12a34-5678')).toBe('123456');
  });
});
