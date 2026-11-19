import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { PermissionsGuard } from '@core/guards/permissions.guard';
import { User } from '@modules/user/entities/user.entity';

/** GraphQL flavor of PermissionsGuard — same check, GraphQL request extraction. */
@Injectable()
export class GqlPermissionsGuard extends PermissionsGuard {
  protected override getRequest(context: ExecutionContext): { user?: User } {
    return GqlExecutionContext.create(context).getContext<{
      req: { user?: User };
    }>().req;
  }
}
