import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

import { JwtPayload } from '@core/interfaces/jwt-payload.interface';
import { AppConfiguration } from '@infrastructure/config/config.interface';
import { EndedSessionRepository } from '@modules/auth/ended-session.repository';
import { sessionFromCookie } from '@modules/auth/utils/session-cookie';
import { JWT_ALGORITHM, tokenSecret } from '@modules/auth/utils/tokens';
import { User } from '@modules/user/entities/user.entity';
import { UserService } from '@modules/user/services/user.service';

/**
 * The 'custom-jwt' strategy both REST (AuthGuard('custom-jwt')) and GraphQL
 * (GqlAuthGuard) ride. The session travels only in the HttpOnly cookie. Loads
 * the full user with role + permissions so PermissionsGuard can check
 * membership without another query.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'custom-jwt') {
  constructor(
    private readonly userService: UserService,
    private readonly endedSessions: EndedSessionRepository,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: sessionFromCookie,
      ignoreExpiration: false,
      algorithms: [JWT_ALGORITHM],
      secretOrKey: tokenSecret(
        configService.getOrThrow<AppConfiguration>('app').jwtSecret,
        'session',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    if (payload.type !== 'session') {
      throw new UnauthorizedException('Not a session token');
    }
    const user = await this.userService.findById(payload.sub);
    if (!user || !user.isActive || user.sessionVersion !== payload.sv) {
      throw new UnauthorizedException('Session ended');
    }
    if (payload.sid && (await this.endedSessions.isEnded(payload.sid))) {
      throw new UnauthorizedException('Session ended');
    }
    return user;
  }
}
