import { Exclude } from 'class-transformer';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { BaseModel } from '@core/models/base.model';
import { Role } from '@modules/role/entities/role.entity';

/**
 * Sensitive fields carry @Exclude so REST serialization strips them
 * (ClassSerializerInterceptor is global); the GraphQL schema simply never
 * declares them. Stripping is the owning domain's job.
 */
@Entity('users')
export class User extends BaseModel {
  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Exclude()
  @Column({ name: 'otp_hash', type: 'text', nullable: true })
  otpHash: string | null;

  @Exclude()
  @Column({ name: 'otp_expires_at', type: 'timestamptz', nullable: true })
  otpExpiresAt: Date | null;

  /** Wrong tries on the current code; after a few the code stops working. */
  @Exclude()
  @Column({ name: 'otp_attempts', default: 0 })
  otpAttempts: number;

  /** Bumped on sign-out and password reset, which ends every open session. */
  @Exclude()
  @Column({ name: 'session_version', default: 0 })
  sessionVersion: number;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
