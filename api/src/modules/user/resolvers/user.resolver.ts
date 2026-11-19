import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { RequirePermission } from '@core/decorators/require-permission.decorator';
import { PaginationDto } from '@core/dto/pagination.dto';
import { PermissionEnum } from '@core/enums/permission.enum';
import { GqlAuthGuard } from '@core/guards/gql-auth.guard';
import { GqlPermissionsGuard } from '@core/guards/gql-permissions.guard';
import { CreateUserInput } from '@modules/user/dto/create-user.input';
import { FilterUsersInput } from '@modules/user/dto/filter-users.input';
import { UpdateUserInput } from '@modules/user/dto/update-user.input';
import { UserService } from '@modules/user/services/user.service';

@Resolver('User')
@UseGuards(GqlAuthGuard, GqlPermissionsGuard)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query('users')
  @RequirePermission(PermissionEnum.USER_READ)
  findAll(
    @Args('pagination') pagination?: PaginationDto,
    @Args('filters') filters?: FilterUsersInput,
  ) {
    return this.userService.findAllPaginated(pagination, filters);
  }

  @Query('user')
  @RequirePermission(PermissionEnum.USER_READ)
  findOne(@Args('id') id: number) {
    return this.userService.findById(id);
  }

  @Mutation('createUser')
  @RequirePermission(PermissionEnum.USER_CREATE)
  create(@Args('createUserInput') createUserInput: CreateUserInput) {
    return this.userService.create(createUserInput);
  }

  @Mutation('updateUser')
  @RequirePermission(PermissionEnum.USER_UPDATE)
  update(
    @Args('id') id: number,
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
  ) {
    return this.userService.update(id, updateUserInput);
  }

  @Mutation('removeUser')
  @RequirePermission(PermissionEnum.USER_DELETE)
  async remove(@Args('id') id: number) {
    await this.userService.remove(id).catch(() => {
      throw new NotFoundException('User not found');
    });
    return { ok: true };
  }
}
