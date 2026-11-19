import { describe, expect, it } from 'vitest';

import { readLoginState, returnPath } from '@modules/auth/loginState';

describe('readLoginState', () => {
  it('reads the fields it knows', () => {
    expect(readLoginState({ from: '/seats', passwordSaved: true, email: 'a@school.org' })).toEqual({
      from: '/seats',
      passwordSaved: true,
      email: 'a@school.org',
    });
  });

  it('ignores missing or wrongly typed state', () => {
    expect(readLoginState(null)).toEqual({});
    expect(readLoginState('x')).toEqual({});
    expect(readLoginState({ from: 3, passwordSaved: 'yes', email: {} })).toEqual({
      from: undefined,
      passwordSaved: false,
      email: undefined,
    });
  });
});

describe('returnPath', () => {
  it('returns to the page the manager was opening', () => {
    expect(returnPath('/seats')).toBe('/seats');
    expect(returnPath('/room?layout=pods')).toBe('/room?layout=pods');
  });

  it('goes home when there is nowhere to return to', () => {
    expect(returnPath(undefined)).toBe('/');
    expect(returnPath('')).toBe('/');
  });

  it('never leaves the app', () => {
    expect(returnPath('//evil.example/x')).toBe('/');
    expect(returnPath('https://evil.example')).toBe('/');
  });

  it('does not loop back to the sign-in pages', () => {
    expect(returnPath('/auth/login')).toBe('/');
  });
});
