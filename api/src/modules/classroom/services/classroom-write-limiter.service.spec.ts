import { HttpException } from '@nestjs/common';

import { ClassroomWriteLimiterService } from '@modules/classroom/services/classroom-write-limiter.service';

describe('ClassroomWriteLimiterService', () => {
  it('lets a teacher create 10 classes a minute, refuses the 11th, and forgets after a minute', () => {
    const limiter = new ClassroomWriteLimiterService();
    for (let i = 0; i < 10; i++) limiter.assertAllowed('create', 1, 0);
    expect(() => limiter.assertAllowed('create', 1, 0)).toThrow(HttpException);
    expect(() => limiter.assertAllowed('create', 2, 0)).not.toThrow();
    expect(() => limiter.assertAllowed('save', 1, 0)).not.toThrow();
    expect(() => limiter.assertAllowed('create', 1, 60_000)).not.toThrow();
  });

  it('allows more saves than autosave ever sends in a minute', () => {
    const limiter = new ClassroomWriteLimiterService();
    for (let i = 0; i < 75; i++) {
      expect(() => limiter.assertAllowed('save', 1, i * 800)).not.toThrow();
    }
  });

  it('refuses the 121st save in a minute with 429 Too Many Requests', () => {
    const limiter = new ClassroomWriteLimiterService();
    for (let i = 0; i < 120; i++) limiter.assertAllowed('save', 1, 0);
    try {
      limiter.assertAllowed('save', 1, 0);
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });
});
