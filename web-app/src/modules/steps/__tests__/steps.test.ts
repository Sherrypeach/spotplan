import { describe, expect, it } from 'vitest';

import { nextStep, previousStep, stepAt, STEPS } from '@modules/steps/steps';

describe('steps', () => {
  it('runs teammates, room, seats, chart, numbered from 1', () => {
    expect(STEPS.map((step) => [step.number, step.key])).toEqual([
      [1, 'students'],
      [2, 'room'],
      [3, 'seats'],
      [4, 'chart'],
    ]);
  });

  it('gives each step its own path', () => {
    const paths = STEPS.map((step) => step.path);
    expect(new Set(paths).size).toBe(paths.length);
    paths.forEach((path) => expect(path).toMatch(/^\/[a-z]+$/));
  });

  it('finds the step for a path, including paths below it', () => {
    expect(stepAt('/room')?.key).toBe('room');
    expect(stepAt('/seats/swap')?.key).toBe('seats');
    expect(stepAt('/')).toBeUndefined();
  });

  it('does not mistake a longer path for a step', () => {
    expect(stepAt('/roomy')).toBeUndefined();
    expect(stepAt('/students-archive')).toBeUndefined();
  });

  it('links each step to the ones before and after it', () => {
    expect(nextStep(STEPS[0])?.key).toBe('room');
    expect(nextStep(STEPS[3])).toBeUndefined();
    expect(previousStep(STEPS[1])?.key).toBe('students');
    expect(previousStep(STEPS[0])).toBeUndefined();
  });
});
