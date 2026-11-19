import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT auth for resolvers.
 * Same 'custom-jwt' strategy as REST — only the request extraction differs.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('custom-jwt') {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext<{ req: Request }>()
      .req;
  }
}
