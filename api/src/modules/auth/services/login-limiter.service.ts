import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { FixedWindowCounter } from '@core/utils/fixed-window-counter';

const WINDOW_MS = 60_000;
const ATTEMPTS_PER_IP = 10;
const ATTEMPTS_BEFORE_LOCK = 5;
const LOCK_MS = 15 * 60_000;

/**
 * What the attempts are for; each keeps its own counts. Asking for a reset
 * code and checking one are separate, so sending a code doesn't use up the
 * tries for typing it.
 */
export type AttemptKind = 'sign-in' | 'reset-request' | 'password-reset';

/**
 * Slows down guessing: a limit on attempts per address each minute, and a lock
 * on an account after repeated attempts that didn't succeed, from any address.
 * An attempt counts against the account as soon as it starts, so a burst of
 * parallel guesses can't slip past the lock. Kept in memory, which is enough
 * for a single API process.
 */
@Injectable()
export class LoginLimiterService {
  private readonly attemptsByIp = new FixedWindowCounter();
  private readonly attemptsByAccount = new FixedWindowCounter();

  assertAllowed(
    kind: AttemptKind,
    ip: string,
    email: string,
    now = Date.now(),
  ): void {
    // The address is checked first: a flood from one address is turned away
    // before it can fill the per-account table.
    const fromIp = this.attemptsByIp.bump(`${kind}|${ip}`, WINDOW_MS, now);
    if (fromIp > ATTEMPTS_PER_IP) this.refuse();
    const onAccount = this.attemptsByAccount.bump(
      `${kind}|${email}`,
      LOCK_MS,
      now,
    );
    if (onAccount > ATTEMPTS_BEFORE_LOCK) this.refuse();
  }

  private refuse(): never {
    throw new HttpException(
      'Too many attempts. Try again in a few minutes.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  recordSuccess(kind: AttemptKind, email: string): void {
    this.attemptsByAccount.delete(`${kind}|${email}`);
  }
}
