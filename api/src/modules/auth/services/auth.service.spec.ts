import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AppEmailService } from '@infrastructure/email/email.service';
import { EndedSessionRepository } from '@modules/auth/ended-session.repository';
import { AuthService } from '@modules/auth/services/auth.service';
import { LoginLimiterService } from '@modules/auth/services/login-limiter.service';
import { tokenSecret } from '@modules/auth/utils/tokens';
import { User } from '@modules/user/entities/user.entity';
import { UserService } from '@modules/user/services/user.service';

const appConfig = {
  saltRounds: 4,
  jwtSecret: 'test-secret',
  sessionTtlHours: 168,
  otpTtlMinutes: 15,
  resetTokenTtlMinutes: 10,
  webUrl: 'http://localhost:5173',
};

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  const userService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    setOtp: jest.fn(),
    clearOtp: jest.fn(),
    changePassword: jest.fn(),
    endAllSessions: jest.fn(),
    countOtpAttempt: jest.fn(),
  };
  const emailService = { send: jest.fn().mockResolvedValue(undefined) };
  const endedSessions = { end: jest.fn(), isEnded: jest.fn() };

  const activeUser = async (): Promise<User> =>
    Object.assign(new User(), {
      id: 1,
      email: 'a@b.co',
      password: await bcrypt.hash('correct-password', 4),
      isActive: true,
      sessionVersion: 3,
      otpAttempts: 0,
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        LoginLimiterService,
        { provide: UserService, useValue: userService },
        { provide: AppEmailService, useValue: emailService },
        { provide: EndedSessionRepository, useValue: endedSessions },
        { provide: ConfigService, useValue: { getOrThrow: () => appConfig } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  describe('login', () => {
    it('starts a session token carrying the user and their session version', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      const session = await service.login('A@b.co ', 'correct-password', 'ip');
      const payload = await jwtService.verifyAsync<{
        sub: number;
        sv: number;
        type: string;
      }>(session.token, {
        secret: tokenSecret(appConfig.jwtSecret, 'session'),
      });
      expect(payload).toMatchObject({ sub: 1, sv: 3, type: 'session' });
      expect(session.maxAgeMs).toBe(168 * 3_600_000);
      expect(userService.findByEmail).toHaveBeenCalledWith('a@b.co');
    });

    it('rejects a wrong password', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      await expect(service.login('a@b.co', 'wrong', 'ip')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unknown email the same way', async () => {
      userService.findByEmail.mockResolvedValue(null);
      await expect(service.login('ghost@b.co', 'x', 'ip')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an inactive user', async () => {
      userService.findByEmail.mockResolvedValue(
        Object.assign(await activeUser(), { isActive: false }),
      );
      await expect(
        service.login('a@b.co', 'correct-password', 'ip'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses passwords longer than bcrypt can check', async () => {
      await expect(
        service.login('a@b.co', 'é'.repeat(40), 'ip'),
      ).rejects.toThrow(BadRequestException);
    });

    it('locks an account after repeated failures, even with the right password', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      for (let i = 0; i < 5; i++) {
        await service.login('a@b.co', 'wrong', `ip${i}`).catch(() => undefined);
      }
      await expect(
        service.login('a@b.co', 'correct-password', 'other-ip'),
      ).rejects.toThrow('Too many attempts');
    });
  });

  describe('logout', () => {
    it('ends only this device’s session, until its token would expire', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      const { token } = await service.login('a@b.co', 'correct-password', 'ip');
      const { sid, exp } = jwtService.decode<{ sid: string; exp: number }>(
        token,
      );

      await service.logout(await activeUser(), token);
      expect(endedSessions.end).toHaveBeenCalledWith(sid, new Date(exp * 1000));
      expect(userService.endAllSessions).not.toHaveBeenCalled();
    });

    it('gives each sign-in its own session id', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      const first = await service.login('a@b.co', 'correct-password', 'ip');
      const second = await service.login('a@b.co', 'correct-password', 'ip');
      const sid = (token: string) =>
        jwtService.decode<{ sid: string }>(token).sid;
      expect(sid(first.token)).not.toEqual(sid(second.token));
    });

    it('ends every session when the token has no session id (signed in before this change)', async () => {
      const oldToken = await jwtService.signAsync(
        { sub: 1, type: 'session', sv: 3 },
        { secret: 'test-secret', expiresIn: '1h' },
      );
      await service.logout(await activeUser(), oldToken);
      expect(userService.endAllSessions).toHaveBeenCalledWith(1);
      expect(endedSessions.end).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    // The code is made and emailed after the answer; resolves once it's sent.
    const nextEmailSent = () =>
      new Promise<void>((resolve) =>
        emailService.send.mockImplementationOnce(() => {
          resolve();
          return Promise.resolve();
        }),
      );

    it('answers ok whether or not the email exists (no enumeration)', async () => {
      userService.findByEmail.mockResolvedValue(null);
      await expect(service.forgotPassword('ghost@b.co', 'ip')).resolves.toEqual(
        { ok: true },
      );
      expect(userService.setOtp).not.toHaveBeenCalled();

      userService.findByEmail.mockResolvedValue(await activeUser());
      const sent = nextEmailSent();
      await expect(service.forgotPassword('a@b.co', 'ip')).resolves.toEqual({
        ok: true,
      });
      await sent;
      expect(userService.setOtp).toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('answers without waiting for the code to be saved or emailed, so timing reveals nothing', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      userService.setOtp.mockReturnValueOnce(new Promise(() => undefined));
      await expect(service.forgotPassword('a@b.co', 'ip')).resolves.toEqual({
        ok: true,
      });
    });

    it('keeps a failed email to the log, without the address or the code', async () => {
      const logged = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      userService.findByEmail.mockResolvedValue(await activeUser());
      const failed = new Promise<void>((resolve) =>
        emailService.send.mockImplementationOnce(() => {
          resolve();
          return Promise.reject(new Error('mail down'));
        }),
      );
      await expect(service.forgotPassword('a@b.co', 'ip')).resolves.toEqual({
        ok: true,
      });
      await failed;
      await new Promise((resolve) => setImmediate(resolve));
      expect(logged).toHaveBeenCalledWith(
        expect.stringMatching(/user \d+ failed \(Error\)/),
      );
      expect(logged.mock.calls[0][0]).not.toContain('a@b.co');
      logged.mockRestore();
    });

    it('doesn’t use up the tries for typing the code', async () => {
      userService.findByEmail.mockResolvedValue(null);
      for (let i = 0; i < 5; i++) await service.forgotPassword('a@b.co', 'ip');
      await expect(
        service.validateOtp('a@b.co', '000000', 'ip'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(service.forgotPassword('a@b.co', 'ip')).rejects.toThrow(
        'Too many attempts',
      );
    });
  });

  describe('validateOtp', () => {
    it('converts a valid unexpired OTP into a reset token and consumes it', async () => {
      const user = await activeUser();
      user.otpHash = await bcrypt.hash('123456', 4);
      user.otpExpiresAt = new Date(Date.now() + 60_000);
      userService.findByEmail.mockResolvedValue(user);

      const { resetToken } = await service.validateOtp(
        'a@b.co',
        '123456',
        'ip',
      );
      expect(userService.clearOtp).toHaveBeenCalledWith(1);
      const payload = await jwtService.verifyAsync<{ type: string }>(
        resetToken,
        { secret: tokenSecret(appConfig.jwtSecret, 'reset') },
      );
      expect(payload.type).toBe('reset');
    });

    it('rejects an expired OTP', async () => {
      const user = await activeUser();
      user.otpHash = await bcrypt.hash('123456', 4);
      user.otpExpiresAt = new Date(Date.now() - 1000);
      userService.findByEmail.mockResolvedValue(user);
      await expect(
        service.validateOtp('a@b.co', '123456', 'ip'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a code that isn’t six digits', async () => {
      const user = await activeUser();
      user.otpHash = await bcrypt.hash('abc', 4);
      user.otpExpiresAt = new Date(Date.now() + 60_000);
      userService.findByEmail.mockResolvedValue(user);
      await expect(service.validateOtp('a@b.co', 'abc', 'ip')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refuses an email longer than any real address', async () => {
      await expect(
        service.forgotPassword(`${'a'.repeat(300)}@b.co`, 'ip'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateOtp limits', () => {
    it('stops accepting a code after 5 wrong tries', async () => {
      const user = await activeUser();
      user.otpHash = await bcrypt.hash('123456', 4);
      user.otpExpiresAt = new Date(Date.now() + 60_000);
      user.otpAttempts = 5;
      userService.findByEmail.mockResolvedValue(user);
      await expect(
        service.validateOtp('a@b.co', '123456', 'ip'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('counts a wrong try against the code', async () => {
      const user = await activeUser();
      user.otpHash = await bcrypt.hash('123456', 4);
      user.otpExpiresAt = new Date(Date.now() + 60_000);
      userService.findByEmail.mockResolvedValue(user);
      await expect(
        service.validateOtp('a@b.co', '000000', 'ip'),
      ).rejects.toThrow();
      expect(userService.countOtpAttempt).toHaveBeenCalledWith(1);
    });
  });

  describe('resetPassword', () => {
    it('works once: the new password moves the session version on', async () => {
      const user = await activeUser();
      user.otpHash = await bcrypt.hash('123456', 4);
      user.otpExpiresAt = new Date(Date.now() + 60_000);
      userService.findByEmail.mockResolvedValue(user);
      const { resetToken } = await service.validateOtp(
        'a@b.co',
        '123456',
        'ip',
      );
      userService.findById.mockResolvedValue(user);
      await service.resetPassword(resetToken, 'new-password-1');
      userService.findById.mockResolvedValue({ ...user, sessionVersion: 4 });
      await expect(
        service.resetPassword(resetToken, 'new-password-2'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a password shorter than 8 characters', async () => {
      await expect(service.resetPassword('any-token', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.resetPassword('any-token', '🎉'.repeat(4)),
      ).rejects.toThrow('at least 8');
      expect(userService.changePassword).not.toHaveBeenCalled();
    });

    it('refuses a password longer than bcrypt can check', async () => {
      await expect(
        service.resetPassword('any-token', 'é'.repeat(37)),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a session token', async () => {
      userService.findByEmail.mockResolvedValue(await activeUser());
      const { token } = await service.login('a@b.co', 'correct-password', 'ip');
      await expect(
        service.resetPassword(token, 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(userService.changePassword).not.toHaveBeenCalled();
    });
  });
});
