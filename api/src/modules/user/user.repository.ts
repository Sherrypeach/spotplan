import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { GenericRepository } from '@core/abstracts/generic.repository';
import { TypeOrmRepository } from '@core/abstracts/typeorm.repository';
import { FilterUsersInput } from '@modules/user/dto/filter-users.input';
import { User } from '@modules/user/entities/user.entity';

@Injectable()
export class UserRepository
  extends TypeOrmRepository<User>
  implements GenericRepository<User>
{
  protected relations: string[] = ['role', 'role.permissions'];

  constructor(@InjectRepository(User) protected repository: Repository<User>) {
    super(repository);
  }

  protected parseFilters(filters?: FilterUsersInput): FindOptionsWhere<User> {
    const where: FindOptionsWhere<User> = {};
    if (!filters) return where;
    if (filters.search) where.email = ILike(`%${filters.search}%`);
    if (filters.isActive !== undefined && filters.isActive !== null)
      where.isActive = filters.isActive;
    if (filters.roleId) where.role = { id: filters.roleId };
    return where;
  }

  async incrementOtpAttempts(id: number): Promise<void> {
    await this.repository.increment({ id }, 'otpAttempts', 1);
  }

  /** A hard delete, so the database removes the teacher's classes with them. */
  async deleteForGood(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: this.relations,
    });
  }
}
