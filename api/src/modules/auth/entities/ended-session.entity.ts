import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A session that was signed out before its token expired. Signing out on one
 * device ends only that device's session; its token is refused until it would
 * have expired anyway, then the row can go.
 */
@Entity('ended_sessions')
export class EndedSession {
  @PrimaryColumn('uuid', {
    name: 'session_id',
    primaryKeyConstraintName: 'PK_ended_sessions',
  })
  sessionId: string;

  @Index('IDX_ended_sessions_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
