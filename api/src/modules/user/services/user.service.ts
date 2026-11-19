import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PaginationDto } from '@core/dto/pagination.dto';
import { PageResult } from '@core/interfaces/page-result.interface';
import { AppConfiguration } from '@infrastructure/config/config.interface';
import { normalizeEmail } from '@modules/auth/utils/password-rules';
import { RoleService } from '@modules/role/services/role.service';
import { CreateUserInput } from '@modules/user/dto/create-user.input';
import { FilterUsersInput } from '@modules/user/dto/filter-users.input';
import { UpdateUserInput } from '@modules/user/dto/update-user.input';
import { User } from '@modules/user/entities/user.entity';
import { UserRepository } from '@modules/user/user.repository';
import { RoleEnum } from '@core/enums/role.enum';

@Injectable()
export class UserService {
  private readonly saltRounds: number;

  constructor(
    private readonly repository: UserRepository,
    private readonly roleService: RoleService,
    configService: ConfigService,
  ) {
    this.saltRounds =
      configService.get<AppConfiguration>('app')?.saltRounds ?? 10;
  }

  findAllPaginated(
    pagination?: PaginationDto,
    filters?: FilterUsersInput,
  ): Promise<PageResult<User>> {
    return this.repository.findAllPaginated(pagination, filters);
  }

  findById(id: number): Promise<User | null> {
    return this.repository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);
    const existing = await this.repository.findByEmail(email);
    if (existing) throw new BadRequestException('Email already registered');

    const role = input.roleId
      ? await this.roleService.findById(input.roleId)
      : await this.roleService.findByName(RoleEnum.USER);
    if (!role) throw new BadRequestException('Role not found');

    return this.repository.create({
      email,
      password: await bcrypt.hash(input.password, this.saltRounds),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      role,
    });
  }

  async update(id: number, input: UpdateUserInput): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (input.roleId) {
      const role = await this.roleService.findById(input.roleId);
      if (!role) throw new BadRequestException('Role not found');
      user.role = role;
    }
    if (input.firstName !== undefined) user.firstName = input.firstName;
    if (input.lastName !== undefined) user.lastName = input.lastName;
    if (input.isActive !== undefined && input.isActive !== null)
      user.isActive = input.isActive;

    return this.repository.create(user);
  }

  /** Deletes the account for good, with every class and student in it. */
  async remove(id: number): Promise<void> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.repository.deleteForGood(id);
  }

  async changePassword(id: number, password: string): Promise<void> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.repository.update(id, {
      password: await bcrypt.hash(password, this.saltRounds),
      sessionVersion: user.sessionVersion + 1,
    });
  }

  async endAllSessions(id: number): Promise<void> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.repository.update(id, {
      sessionVersion: user.sessionVersion + 1,
    });
  }

  async setOtp(id: number, otpHash: string, otpExpiresAt: Date): Promise<void> {
    await this.repository.update(id, { otpHash, otpExpiresAt, otpAttempts: 0 });
  }

  async countOtpAttempt(id: number): Promise<void> {
    await this.repository.incrementOtpAttempts(id);
  }

  async clearOtp(id: number): Promise<void> {
    await this.repository.update(id, {
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    });
  }
}
