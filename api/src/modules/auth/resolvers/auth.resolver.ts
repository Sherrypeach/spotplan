import { UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Request, Response } from 'express';

import { CurrentUser } from '@core/decorators/user.decorator';
import { GqlAuthGuard } from '@core/guards/gql-auth.guard';
import { AppConfiguration } from '@infrastructure/config/config.interface';
import { LoginInput } from '@modules/auth/dto/login.input';
import { AuthService } from '@modules/auth/services/auth.service';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionFromCookie,
} from '@modules/auth/utils/session-cookie';
import { User } from '@modules/user/entities/user.entity';

/**
 * Signing in and recovering a password are public by nature; `me` and
 * `logout` need a session. Every other resolver is guarded at class level with
 * GqlAuthGuard + GqlPermissionsGuard.
 */
@Resolver('Auth')
export class AuthResolver {
  private readonly secureCookies: boolean;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.secureCookies =
      configService.get<AppConfiguration>('app')?.secureCookies ?? true;
  }

  @Mutation('login')
  async login(
    @Args('loginInput') loginInput: LoginInput,
    @Context('req') req: Request,
    @Context('res') res: Response,
  ) {
    const session = await this.authService.login(
      loginInput.email,
      loginInput.password,
      req.ip ?? '',
    );
    res.cookie(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(this.secureCookies, session.maxAgeMs),
    );
    return session.user;
  }

  @Mutation('logout')
  @UseGuards(GqlAuthGuard)
  async logout(
    @CurrentUser() user: User,
    @Context('req') req: Request,
    @Context('res') res: Response,
  ) {
    await this.authService.logout(user, sessionFromCookie(req) ?? undefined);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.secureCookies));
    return { ok: true };
  }

  @Mutation('forgotPassword')
  forgotPassword(@Args('email') email: string, @Context('req') req: Request) {
    return this.authService.forgotPassword(email, req.ip ?? '');
  }

  @Mutation('validateOtp')
  validateOtp(
    @Args('email') email: string,
    @Args('otp') otp: string,
    @Context('req') req: Request,
  ) {
    return this.authService.validateOtp(email, otp, req.ip ?? '');
  }

  @Mutation('resetPassword')
  resetPassword(
    @Args('resetToken') resetToken: string,
    @Args('password') password: string,
  ) {
    return this.authService.resetPassword(resetToken, password);
  }

  @Query('me')
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: User) {
    return user;
  }
}
