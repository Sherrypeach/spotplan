import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_PERMISSION_KEY } from '@core/decorators/require-permission.decorator';
import { PermissionEnum } from '@core/enums/permission.enum';
import { User } from '@modules/user/entities/user.entity';

interface RequestWithUser {
  user?: User;
}

/**
 * Enforces @RequirePermission on REST handlers. The JWT strategy loads the
 * user with role + permissions, so this guard only checks membership.
 * A handler without @RequirePermission passes on sign-in alone, so every
 * endpoint must declare one.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(protected readonly reflector: Reflector) {}

  protected getRequest(context: ExecutionContext): RequestWithUser {
    return context.switchToHttp().getRequest<RequestWithUser>();
  }

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      PermissionEnum[] | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const user = this.getRequest(context).user;
    const granted = new Set(user?.role?.permissions?.map((p) => p.name) ?? []);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
