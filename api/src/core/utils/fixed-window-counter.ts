// Forget old entries once this many pile up, so memory stays bounded.
const MAX_TRACKED = 10_000;

type Window = { startedAt: number; count: number };

/**
 * Counts events per key in fixed time windows, in memory (enough for a single
 * API process). Used to limit how often something can be done.
 */
export class FixedWindowCounter {
  private readonly windows = new Map<string, Window>();

  /** Counts one more event for `key` and returns the count in its current window. */
  bump(key: string, windowMs: number, now = Date.now()): number {
    if (this.windows.size > MAX_TRACKED) this.forgetOld(windowMs, now);
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return 1;
    }
    current.count++;
    return current.count;
  }

  /** How many keys are being tracked. */
  get size(): number {
    return this.windows.size;
  }

  delete(key: string): void {
    this.windows.delete(key);
  }

  private forgetOld(windowMs: number, now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= windowMs) this.windows.delete(key);
    }
    // Still full of live entries: drop the oldest (a Map keeps insertion order).
    for (const key of this.windows.keys()) {
      if (this.windows.size <= MAX_TRACKED) break;
      this.windows.delete(key);
    }
  }
}
