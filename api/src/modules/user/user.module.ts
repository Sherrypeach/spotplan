import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoleModule } from '@modules/role/role.module';
import { User } from '@modules/user/entities/user.entity';
import { UserResolver } from '@modules/user/resolvers/user.resolver';
import { UserService } from '@modules/user/services/user.service';
import { UserRepository } from '@modules/user/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RoleModule],
  providers: [UserResolver, UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
