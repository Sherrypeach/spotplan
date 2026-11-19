import { randomInt, randomUUID } from 'crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { JwtPayload } from '@core/interfaces/jwt-payload.interface';
import { AppConfiguration } from '@infrastructure/config/config.interface';
import { AppEmailService } from '@infrastructure/email/email.service';
import { EndedSessionRepository } from '@modules/auth/ended-session.repository';
import { Session } from '@modules/auth/interfaces/session.interface';
import { LoginLimiterService } from '@modules/auth/services/login-limiter.service';
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
} from '@modules/auth/utils/password-rules';
import { JWT_ALGORITHM, tokenSecret } from '@modules/auth/utils/tokens';
import { User } from '@modules/user/entities/user.entity';
import { UserService } from '@modules/user/services/user.service';

const MAX_OTP_ATTEMPTS = 5;
// Compared against when the email is unknown, so a wrong email takes as long
// to reject as a wrong password and doesn't reveal which accounts exist.

// A reset code is exactly six digits; a reset token is a short JWT.
const OTP_PATTERN = /^\d{6}$/;
const MAX_RESET_TOKEN_LENGTH = 2048;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appConfig: AppConfiguration;
  // Checked against when the email is unknown, at the same cost as real
  // passwords, so a wrong email takes as long as a wrong password.
  private readonly dummyHash: string;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: AppEmailService,
    private readonly loginLimiter: LoginLimiterService,
    private readonly endedSessions: EndedSessionRepository,
    configService: ConfigService,
  ) {
    this.appConfig = configService.getOrThrow<AppConfiguration>('app');
    this.dummyHash = bcrypt.hashSync(
      'not-a-real-password',
      this.appConfig.saltRounds,
    );
  }

  async login(email: string, password: string, ip: string): Promise<Session> {
    const normalizedEmail = normalizeEmail(email);
    this.loginLimiter.assertAllowed('sign-in', ip, normalizedEmail);
    this.assertPasswordLength(password);

    const user = await this.userService.findByEmail(normalizedEmail);
    const matches = await bcrypt.compare(
      password,
      user?.password ?? this.dummyHash,
    );
    if (!user || !user.isActive || !matches) {
      throw new UnauthorizedException('That email and password don’t match.');
    }
    this.loginLimiter.recordSuccess('sign-in', normalizedEmail);
    return this.startSession(user);
  }

  /**
   * Ends this device's session only; other devices stay signed in. (A new
   * password still ends them all.) `token` is the session cookie the guard
   * has just accepted.
   */
  async logout(user: User, token: string | undefined): Promise<void> {
    const payload = token ? this.jwtService.decode<JwtPayload>(token) : null;
    // Sessions started before per-device sign-out carry no id: end them all.
    if (!payload?.sid || !payload.exp) {
      await this.userService.endAllSessions(user.id);
      return;
    }
    await this.endedSessions.end(payload.sid, new Date(payload.exp * 1000));
  }

  /**
   * Always answers ok, and equally fast, so neither the answer nor its
   * timing reveals whether an email has an account: the code is made and
   * emailed after the reply.
   */
  async forgotPassword(email: string, ip: string): Promise<{ ok: boolean }> {
    const normalizedEmail = normalizeEmail(email);
    this.loginLimiter.assertAllowed('reset-request', ip, normalizedEmail);
    const user = await this.userService.findByEmail(normalizedEmail);
    // A switched-off account gets no code: it can't sign in anyway.
    if (user?.isActive) void this.sendResetCode(user);
    return { ok: true };
  }

  /**
   * A valid code converts into a short-lived reset token and is consumed. A
   * code allows a few tries, then stops working.
   */
  async validateOtp(
    email: string,
    otp: string,
    ip: string,
  ): Promise<{ resetToken: string }> {
    const normalizedEmail = normalizeEmail(email);
    this.loginLimiter.assertAllowed('password-reset', ip, normalizedEmail);
    const user = await this.userService.findByEmail(normalizedEmail);
    const usable =
      !!user?.otpHash &&
      !!user.otpExpiresAt &&
      user.otpExpiresAt.getTime() > Date.now() &&
      user.otpAttempts < MAX_OTP_ATTEMPTS;
    // Always one bcrypt compare, so the reply takes as long whether or not the
    // account exists or has a live code.
    const matches = await bcrypt.compare(
      OTP_PATTERN.test(otp) ? otp : '',
      usable ? user.otpHash! : this.dummyHash,
    );
    const valid = usable && OTP_PATTERN.test(otp) && matches;
    if (!user || !valid) {
      if (user && usable) await this.userService.countOtpAttempt(user.id);
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.userService.clearOtp(user.id);
    this.loginLimiter.recordSuccess('password-reset', normalizedEmail);
    // Carries the session version, which the new password bumps, so the
    // token works once.
    const resetToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        type: 'reset',
        sv: user.sessionVersion,
      } satisfies JwtPayload,
      {
        secret: tokenSecret(this.appConfig.jwtSecret, 'reset'),
        algorithm: JWT_ALGORITHM,
        expiresIn:
          `${this.appConfig.resetTokenTtlMinutes}m` as JwtSignOptions['expiresIn'],
      },
    );
    return { resetToken };
  }

  /** Setting a new password also ends every open session. */
  async resetPassword(
    resetToken: string,
    password: string,
  ): Promise<{ ok: boolean }> {
    this.assertNewPassword(password);
    if (resetToken.length > MAX_RESET_TOKEN_LENGTH) {
      throw new UnauthorizedException('Invalid reset token');
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(resetToken, {
        secret: tokenSecret(this.appConfig.jwtSecret, 'reset'),
        algorithms: [JWT_ALGORITHM],
      });
    } catch {
      throw new UnauthorizedException('Invalid reset token');
    }
    if (payload.type !== 'reset')
      throw new UnauthorizedException('Not a reset token');
    const user = await this.userService.findById(payload.sub);
    if (!user || user.sessionVersion !== payload.sv) {
      throw new UnauthorizedException('This reset code was already used');
    }

    await this.userService.changePassword(payload.sub, password);
    return { ok: true };
  }

  /** Never throws: the caller has already answered. */
  private async sendResetCode(user: User): Promise<void> {
    try {
      const otp = randomInt(100000, 1000000).toString();
      const expires = new Date(
        Date.now() + this.appConfig.otpTtlMinutes * 60_000,
      );
      await this.userService.setOtp(
        user.id,
        await bcrypt.hash(otp, this.appConfig.saltRounds),
        expires,
      );
      await this.emailService.send(
        'Reset your password',
        user.email,
        this.resetEmail(otp),
      );
    } catch (error) {
      // The user id and error type, never the email or the code.
      const kind = error instanceof Error ? error.name : 'unknown error';
      this.logger.error(
        `Sending a password reset code to user ${user.id} failed (${kind})`,
      );
    }
  }

  private resetEmail(otp: string): string {
    const { otpTtlMinutes, webUrl } = this.appConfig;
    const code = `<p>Your one-time code is <strong>${otp}</strong> (valid ${otpTtlMinutes} minutes).</p>`;
    const link = webUrl
      ? `<p>To use it, open <a href="${webUrl}/auth/reset">${webUrl}/auth/reset</a>, choose “I already have a code”, and type it in.</p>`
      : '';
    return code + link;
  }

  private assertPasswordLength(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new BadRequestException(
        'That password is too long. Use a shorter one.',
      );
    }
  }

  /** Rules for a password being set, on top of the length bcrypt can check. */
  private assertNewPassword(password: string): void {
    // Counted as people see characters, so an emoji counts once.
    if ([...password].length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    this.assertPasswordLength(password);
  }

  private async startSession(user: User): Promise<Session> {
    const hours = this.appConfig.sessionTtlHours;
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        type: 'session',
        sv: user.sessionVersion,
        sid: randomUUID(),
      } satisfies JwtPayload,
      {
        secret: tokenSecret(this.appConfig.jwtSecret, 'session'),
        algorithm: JWT_ALGORITHM,
        expiresIn: `${hours}h` as JwtSignOptions['expiresIn'],
      },
    );
    return { user, token, maxAgeMs: hours * 3_600_000 };
  }
}
