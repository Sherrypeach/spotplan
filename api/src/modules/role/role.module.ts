import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Permission } from '@modules/role/entities/permission.entity';
import { Role } from '@modules/role/entities/role.entity';
import { RoleResolver } from '@modules/role/resolvers/role.resolver';
import { RoleRepository } from '@modules/role/role.repository';
import { RoleService } from '@modules/role/services/role.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  providers: [RoleResolver, RoleService, RoleRepository],
  exports: [RoleService],
})
export class RoleModule {}
