import { GUARDS_METADATA } from '@nestjs/common/constants';

import { GqlAuthGuard } from '@core/guards/gql-auth.guard';
import { GqlPermissionsGuard } from '@core/guards/gql-permissions.guard';
import { AuthResolver } from '@modules/auth/resolvers/auth.resolver';
import { ClassroomResolver } from '@modules/classroom/resolvers/classroom.resolver';
import { RoleResolver } from '@modules/role/resolvers/role.resolver';
import { UserResolver } from '@modules/user/resolvers/user.resolver';

const guardsOn = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

/** Fails if a resolver loses its guards, so nothing becomes public by accident. */
describe('resolver guards', () => {
  it.each([ClassroomResolver, RoleResolver, UserResolver])(
    '%p requires a session and permissions on every operation',
    (resolver) => {
      expect(guardsOn(resolver)).toEqual([GqlAuthGuard, GqlPermissionsGuard]);
    },
  );

  it('keeps only sign-in and password recovery public', () => {
    const proto = AuthResolver.prototype as unknown as Record<string, object>;
    expect(guardsOn(proto.me)).toEqual([GqlAuthGuard]);
    expect(guardsOn(proto.logout)).toEqual([GqlAuthGuard]);
    for (const open of [
      'login',
      'forgotPassword',
      'validateOtp',
      'resetPassword',
    ]) {
      expect(guardsOn(proto[open])).toEqual([]);
    }
  });
});
