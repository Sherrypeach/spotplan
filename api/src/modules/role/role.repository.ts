import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GenericRepository } from '@core/abstracts/generic.repository';
import { TypeOrmRepository } from '@core/abstracts/typeorm.repository';
import { Role } from '@modules/role/entities/role.entity';

@Injectable()
export class RoleRepository
  extends TypeOrmRepository<Role>
  implements GenericRepository<Role>
{
  protected relations: string[] = ['permissions'];

  constructor(@InjectRepository(Role) protected repository: Repository<Role>) {
    super(repository);
  }

  findByName(name: string): Promise<Role | null> {
    return this.repository.findOne({
      where: { name },
      relations: this.relations,
    });
  }
}
