import { RoleResolver } from '@modules/role/resolvers/role.resolver';
import { RoleService } from '@modules/role/services/role.service';

describe('RoleResolver', () => {
  it('lists the roles from the service', async () => {
    const roles = [{ id: 1, name: 'teacher' }];
    const service = { findAll: jest.fn().mockResolvedValue(roles) };
    const resolver = new RoleResolver(service as unknown as RoleService);
    await expect(resolver.findAll()).resolves.toBe(roles);
  });
});
