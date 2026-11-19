import { NotFoundException } from '@nestjs/common';

import { UserResolver } from '@modules/user/resolvers/user.resolver';
import { UserService } from '@modules/user/services/user.service';

describe('UserResolver', () => {
  let service: jest.Mocked<
    Pick<
      UserService,
      'findAllPaginated' | 'findById' | 'create' | 'update' | 'remove'
    >
  >;
  let resolver: UserResolver;

  beforeEach(() => {
    service = {
      findAllPaginated: jest.fn().mockResolvedValue({ items: [] }),
      findById: jest.fn().mockResolvedValue({ id: 2 }),
      create: jest.fn().mockResolvedValue({ id: 3 }),
      update: jest.fn().mockResolvedValue({ id: 2 }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    resolver = new UserResolver(service as unknown as UserService);
  });

  it('hands each request to the service as given', async () => {
    const page = { page: 1, limit: 10 };
    await resolver.findAll(page, undefined);
    await resolver.findOne(2);
    await resolver.update(2, { firstName: 'Ana' });
    expect(service.findAllPaginated).toHaveBeenCalledWith(page, undefined);
    expect(service.findById).toHaveBeenCalledWith(2);
    expect(service.update).toHaveBeenCalledWith(2, { firstName: 'Ana' });
  });

  it('answers ok after removing, and "not found" when there was no such user', async () => {
    await expect(resolver.remove(2)).resolves.toEqual({ ok: true });
    service.remove.mockRejectedValueOnce(new Error('missing'));
    await expect(resolver.remove(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
