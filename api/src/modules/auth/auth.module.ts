import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EndedSessionRepository } from '@modules/auth/ended-session.repository';
import { EndedSession } from '@modules/auth/entities/ended-session.entity';
import { AuthResolver } from '@modules/auth/resolvers/auth.resolver';
import { AuthService } from '@modules/auth/services/auth.service';
import { LoginLimiterService } from '@modules/auth/services/login-limiter.service';
import { JwtStrategy } from '@modules/auth/strategies/jwt.strategy';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([EndedSession]),
  ],
  providers: [
    AuthResolver,
    AuthService,
    LoginLimiterService,
    JwtStrategy,
    EndedSessionRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
