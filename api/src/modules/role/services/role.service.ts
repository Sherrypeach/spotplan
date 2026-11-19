import { Injectable } from '@nestjs/common';

import { Role } from '@modules/role/entities/role.entity';
import { RoleRepository } from '@modules/role/role.repository';

@Injectable()
export class RoleService {
  constructor(private readonly repository: RoleRepository) {}

  findAll(): Promise<Role[]> {
    return this.repository.findAll();
  }

  findById(id: number): Promise<Role | null> {
    return this.repository.findById(id);
  }

  findByName(name: string): Promise<Role | null> {
    return this.repository.findByName(name);
  }
}
