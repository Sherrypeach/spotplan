import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { FixedWindowCounter } from '@core/utils/fixed-window-counter';

const WINDOW_MS = 60_000;
// The web autosaves at most once every 800 ms while the teacher works (about
// 75 saves a minute, useAutosave.ts); a script hammering the API goes well past this.
const LIMITS = { save: 120, create: 10 } as const;

export type ClassroomWrite = keyof typeof LIMITS;

/**
 * A cap on class saves and creations per teacher each minute: every save is
 * parsed in full and written to the database, so an endless loop of them
 * would tie up the API.
 */
@Injectable()
export class ClassroomWriteLimiterService {
  private readonly counter = new FixedWindowCounter();

  assertAllowed(write: ClassroomWrite, userId: number, now = Date.now()): void {
    if (
      this.counter.bump(`${write}|${userId}`, WINDOW_MS, now) > LIMITS[write]
    ) {
      throw new HttpException(
        'Too many changes at once. Wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
