import { SetMetadata } from '@nestjs/common';

import { PermissionEnum } from '@core/enums/permission.enum';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Declares the permission a handler needs. Enforced by PermissionsGuard / GqlPermissionsGuard.
 */
export const RequirePermission = (...permissions: PermissionEnum[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
