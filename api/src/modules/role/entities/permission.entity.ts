import { Column, Entity } from 'typeorm';

import { BaseModel } from '@core/models/base.model';

/** Rows are seeded from PermissionEnum — never inserted by hand. */
@Entity('permissions')
export class Permission extends BaseModel {
  @Column({ unique: true })
  name: string;
}
