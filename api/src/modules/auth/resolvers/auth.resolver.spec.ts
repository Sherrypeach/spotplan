import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { AuthResolver } from '@modules/auth/resolvers/auth.resolver';
import { AuthService } from '@modules/auth/services/auth.service';
import { SESSION_COOKIE } from '@modules/auth/utils/session-cookie';
import { User } from '@modules/user/entities/user.entity';

describe('AuthResolver', () => {
  const user = { id: 7, email: 'ana@school.org' } as User;
  let auth: jest.Mocked<
    Pick<
      AuthService,
      'login' | 'logout' | 'forgotPassword' | 'validateOtp' | 'resetPassword'
    >
  >;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };
  const req = { ip: '10.0.0.5', cookies: {} } as unknown as Request;
  const resolverWith = (secureCookies: boolean) =>
    new AuthResolver(
      auth as unknown as AuthService,
      { get: () => ({ secureCookies }) } as unknown as ConfigService,
    );

  beforeEach(() => {
    auth = {
      login: jest
        .fn()
        .mockResolvedValue({ token: 'signed', maxAgeMs: 1000, user }),
      logout: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue({ ok: true }),
      validateOtp: jest.fn().mockResolvedValue({ resetToken: 'reset' }),
      resetPassword: jest.fn().mockResolvedValue({ ok: true }),
    };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  it('signs in with the caller’s address and sets an httpOnly session cookie', async () => {
    const answer = await resolverWith(true).login(
      { email: 'ana@school.org', password: 'secret-pass' },
      req,
      res as unknown as Response,
    );
    expect(auth.login).toHaveBeenCalledWith(
      'ana@school.org',
      'secret-pass',
      '10.0.0.5',
    );
    expect(answer).toBe(user);
    const [name, token, options] = res.cookie.mock.calls[0] as [
      string,
      string,
      { httpOnly: boolean; secure: boolean },
    ];
    expect([name, token]).toEqual([SESSION_COOKIE, 'signed']);
    expect(options).toMatchObject({ httpOnly: true, secure: true });
  });

  it('ends the session and clears the cookie on sign out', async () => {
    await expect(
      resolverWith(false).logout(user, req, res as unknown as Response),
    ).resolves.toEqual({ ok: true });
    expect(auth.logout).toHaveBeenCalledWith(user, undefined);
    expect(res.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.objectContaining({ secure: false }),
    );
  });

  it('passes the caller’s address to the reset steps', async () => {
    const resolver = resolverWith(true);
    await resolver.forgotPassword('ana@school.org', req);
    await resolver.validateOtp('ana@school.org', '123456', req);
    await resolver.resetPassword('reset', 'new-password');
    expect(auth.forgotPassword).toHaveBeenCalledWith(
      'ana@school.org',
      '10.0.0.5',
    );
    expect(auth.validateOtp).toHaveBeenCalledWith(
      'ana@school.org',
      '123456',
      '10.0.0.5',
    );
    expect(auth.resetPassword).toHaveBeenCalledWith('reset', 'new-password');
  });

  it('answers `me` with the signed-in user', () => {
    expect(resolverWith(true).me(user)).toBe(user);
  });
});
