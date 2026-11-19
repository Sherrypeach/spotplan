import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { EndedSession } from '@modules/auth/entities/ended-session.entity';

@Injectable()
export class EndedSessionRepository {
  constructor(
    @InjectRepository(EndedSession)
    private readonly repository: Repository<EndedSession>,
  ) {}

  /** Records a signed-out session and forgets ones whose tokens have expired. */
  async end(
    sessionId: string,
    expiresAt: Date,
    now = new Date(),
  ): Promise<void> {
    await this.repository.upsert({ sessionId, expiresAt }, ['sessionId']);
    // Tidying up is a nicety: if it fails, signing out has still worked.
    await this.repository
      .delete({ expiresAt: LessThan(now) })
      .catch(() => undefined);
  }

  isEnded(sessionId: string): Promise<boolean> {
    return this.repository.existsBy({ sessionId });
  }
}
