import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { RoleEnum } from '@core/enums/role.enum';
import { RoleService } from '@modules/role/services/role.service';
import { UserService } from '@modules/user/services/user.service';
import { UserRepository } from '@modules/user/user.repository';

describe('UserService', () => {
  let service: UserService;
  const repository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn((data: object) => Promise.resolve({ id: 1, ...data })),
    update: jest.fn(),
    delete: jest.fn(),
    findAllPaginated: jest.fn(),
  };
  const roleService = { findById: jest.fn(), findByName: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: repository },
        { provide: RoleService, useValue: roleService },
        {
          provide: ConfigService,
          useValue: { get: () => ({ saltRounds: 4 }) },
        },
      ],
    }).compile();
    service = moduleRef.get(UserService);
  });

  describe('create', () => {
    it('hashes the password and assigns the default user role', async () => {
      repository.findByEmail.mockResolvedValue(null);
      roleService.findByName.mockResolvedValue({ id: 2, name: RoleEnum.USER });

      const user = await service.create({
        email: 'a@b.co',
        password: 'plain-password',
      });

      expect(roleService.findByName).toHaveBeenCalledWith(RoleEnum.USER);
      const saved = repository.create.mock.calls[0][0] as { password: string };
      expect(saved.password).not.toEqual('plain-password');
      expect(await bcrypt.compare('plain-password', saved.password)).toBe(true);
      expect(user.id).toBe(1);
    });

    it('rejects a duplicate email', async () => {
      repository.findByEmail.mockResolvedValue({ id: 9 });
      await expect(
        service.create({ email: 'a@b.co', password: 'plain-password' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown roleId', async () => {
      repository.findByEmail.mockResolvedValue(null);
      roleService.findById.mockResolvedValue(null);
      await expect(
        service.create({
          email: 'a@b.co',
          password: 'plain-password',
          roleId: 99,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('stores the email trimmed and in lower case, so sign-in finds it', async () => {
    repository.findByEmail.mockResolvedValue(null);
    roleService.findByName.mockResolvedValue({ id: 2, name: RoleEnum.USER });
    await service.create({
      email: ' Jane@School.org ',
      password: 'a good password',
    });
    expect(repository.findByEmail).toHaveBeenCalledWith('jane@school.org');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@school.org' }),
    );
  });
});
