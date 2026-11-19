import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EndedSessionRepository } from '@modules/auth/ended-session.repository';
import { JwtStrategy } from '@modules/auth/strategies/jwt.strategy';
import { User } from '@modules/user/entities/user.entity';
import { UserService } from '@modules/user/services/user.service';

describe('JwtStrategy', () => {
  const user = Object.assign(new User(), {
    id: 1,
    isActive: true,
    sessionVersion: 3,
  });
  const userService = { findById: jest.fn().mockResolvedValue(user) };
  const endedSessions = { isEnded: jest.fn() };
  const strategy = new JwtStrategy(
    userService as unknown as UserService,
    endedSessions as unknown as EndedSessionRepository,
    {
      getOrThrow: () => ({ jwtSecret: 'test-secret' }),
    } as unknown as ConfigService,
  );

  beforeEach(() => endedSessions.isEnded.mockReset());

  it('accepts a live session', async () => {
    endedSessions.isEnded.mockResolvedValue(false);
    await expect(
      strategy.validate({ sub: 1, type: 'session', sv: 3, sid: 'a' }),
    ).resolves.toBe(user);
  });

  it('refuses a session signed out on this device', async () => {
    endedSessions.isEnded.mockResolvedValue(true);
    await expect(
      strategy.validate({ sub: 1, type: 'session', sv: 3, sid: 'a' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses every session once the session version moves on', async () => {
    await expect(
      strategy.validate({ sub: 1, type: 'session', sv: 2, sid: 'a' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('still accepts a session from before session ids', async () => {
    await expect(
      strategy.validate({ sub: 1, type: 'session', sv: 3 }),
    ).resolves.toBe(user);
    expect(endedSessions.isEnded).not.toHaveBeenCalled();
  });
});
