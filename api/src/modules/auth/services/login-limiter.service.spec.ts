import { LoginLimiterService } from '@modules/auth/services/login-limiter.service';

describe('LoginLimiterService', () => {
  let limiter: LoginLimiterService;

  beforeEach(() => {
    limiter = new LoginLimiterService();
  });

  it('allows 10 attempts a minute from one address, then refuses', () => {
    for (let i = 0; i < 10; i++)
      limiter.assertAllowed('sign-in', 'ip', `t${i}@x.org`, 1000);
    expect(() =>
      limiter.assertAllowed('sign-in', 'ip', 'other@x.org', 1000),
    ).toThrow();
    expect(() =>
      limiter.assertAllowed('sign-in', 'ip', 'other@x.org', 62_000),
    ).not.toThrow();
  });

  it('locks an account after 5 attempts without success, from any address, for 15 minutes', () => {
    for (let i = 0; i < 5; i++)
      limiter.assertAllowed('sign-in', `ip${i}`, 't@x.org', 1000);
    expect(() =>
      limiter.assertAllowed('sign-in', 'ip-a', 't@x.org', 2000),
    ).toThrow();
    expect(() =>
      limiter.assertAllowed('sign-in', 'ip-b', 't@x.org', 1000 + 15 * 60_000),
    ).not.toThrow();
  });

  it('starts counting again after a success', () => {
    for (let i = 0; i < 4; i++)
      limiter.assertAllowed('sign-in', 'ip', 't@x.org', 1000);
    limiter.recordSuccess('sign-in', 't@x.org');
    for (let i = 0; i < 5; i++)
      limiter.assertAllowed('sign-in', 'ip', 't@x.org', 1000);
  });

  it('counts password resets apart from sign-ins', () => {
    for (let i = 0; i < 5; i++)
      limiter.assertAllowed('sign-in', `ip${i}`, 't@x.org', 1000);
    expect(() =>
      limiter.assertAllowed('password-reset', 'ip', 't@x.org', 1000),
    ).not.toThrow();
  });

  it('counts asking for a reset code apart from checking one', () => {
    for (let i = 0; i < 5; i++)
      limiter.assertAllowed('reset-request', `ip${i}`, 't@x.org', 1000);
    expect(() =>
      limiter.assertAllowed('password-reset', 'ip', 't@x.org', 1000),
    ).not.toThrow();
  });

  it('turns a flooding address away before it can fill the account table', () => {
    for (let i = 0; i < 10; i++)
      limiter.assertAllowed('reset-request', 'ip', `t${i}@x.org`, 1000);
    for (let i = 0; i < 50; i++) {
      expect(() =>
        limiter.assertAllowed('reset-request', 'ip', `flood${i}@x.org`, 1000),
      ).toThrow();
    }
    const tracked = (
      limiter as unknown as { attemptsByAccount: Map<string, unknown> }
    ).attemptsByAccount;
    expect(tracked.size).toBe(10);
  });
});
