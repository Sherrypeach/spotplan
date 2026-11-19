import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { User } from '@modules/user/entities/user.entity';

interface RequestWithUser {
  user?: User;
}

/** Injects the authenticated user into a handler — works for REST and GraphQL. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User | undefined => {
    if (context.getType<'graphql' | 'http'>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext<{
        req: RequestWithUser;
      }>();
      return gqlContext.req.user;
    }
    return context.switchToHttp().getRequest<RequestWithUser>().user;
  },
);
