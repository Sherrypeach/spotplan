import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { RequirePermission } from '@core/decorators/require-permission.decorator';
import { CurrentUser } from '@core/decorators/user.decorator';
import { PermissionEnum } from '@core/enums/permission.enum';
import { GqlAuthGuard } from '@core/guards/gql-auth.guard';
import { GqlPermissionsGuard } from '@core/guards/gql-permissions.guard';
import { CreateClassroomInput } from '@modules/classroom/dto/create-classroom.input';
import { SaveClassroomInput } from '@modules/classroom/dto/save-classroom.input';
import { ClassroomWriteLimiterService } from '@modules/classroom/services/classroom-write-limiter.service';
import { ClassroomService } from '@modules/classroom/services/classroom.service';
import { User } from '@modules/user/entities/user.entity';

@Resolver('Classroom')
@UseGuards(GqlAuthGuard, GqlPermissionsGuard)
export class ClassroomResolver {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly writeLimiter: ClassroomWriteLimiterService,
  ) {}

  @Query('myClassrooms')
  @RequirePermission(PermissionEnum.CLASSROOM_READ)
  findMine(@CurrentUser() user: User) {
    return this.classroomService.findMine(user.id);
  }

  @Query('classroom')
  @RequirePermission(PermissionEnum.CLASSROOM_READ)
  findOne(@CurrentUser() user: User, @Args('id') id: number) {
    return this.classroomService.findOne(id, user.id);
  }

  @Mutation('createClassroom')
  @RequirePermission(PermissionEnum.CLASSROOM_WRITE)
  create(
    @CurrentUser() user: User,
    @Args('createClassroomInput') createClassroomInput: CreateClassroomInput,
  ) {
    this.writeLimiter.assertAllowed('create', user.id);
    return this.classroomService.create(user.id, createClassroomInput);
  }

  @Mutation('saveClassroom')
  @RequirePermission(PermissionEnum.CLASSROOM_WRITE)
  save(
    @CurrentUser() user: User,
    @Args('id') id: number,
    @Args('saveClassroomInput') saveClassroomInput: SaveClassroomInput,
  ) {
    this.writeLimiter.assertAllowed('save', user.id);
    return this.classroomService.save(id, user.id, saveClassroomInput);
  }

  @Mutation('removeClassroom')
  @RequirePermission(PermissionEnum.CLASSROOM_WRITE)
  async remove(@CurrentUser() user: User, @Args('id') id: number) {
    await this.classroomService.remove(id, user.id);
    return { ok: true };
  }
}
