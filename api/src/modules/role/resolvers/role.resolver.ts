import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { RequirePermission } from '@core/decorators/require-permission.decorator';
import { PermissionEnum } from '@core/enums/permission.enum';
import { GqlAuthGuard } from '@core/guards/gql-auth.guard';
import { GqlPermissionsGuard } from '@core/guards/gql-permissions.guard';
import { RoleService } from '@modules/role/services/role.service';

@Resolver('Role')
@UseGuards(GqlAuthGuard, GqlPermissionsGuard)
export class RoleResolver {
  constructor(private readonly roleService: RoleService) {}

  @Query('roles')
  @RequirePermission(PermissionEnum.ROLE_READ)
  findAll() {
    return this.roleService.findAll();
  }
}
