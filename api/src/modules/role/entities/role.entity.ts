import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';

import { BaseModel } from '@core/models/base.model';
import { Permission } from '@modules/role/entities/permission.entity';

@Entity('roles')
export class Role extends BaseModel {
  @Column({ unique: true })
  name: string;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
