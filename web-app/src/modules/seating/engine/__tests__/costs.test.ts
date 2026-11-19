import { describe, expect, it } from 'vitest';

import type { Furniture, Seat } from '@modules/layouts/types';

import { buildRoom, DEFAULT_SETTINGS, scoreSeating } from '..';
import type { Assignment, EngineSettings, Level, Needs, Student } from '..';

// A row of four desks pushed together (seats r0-r3), a desk two widths along
// (c0, close to r3 but not next to it), a far desk (f0) and a desk turned
// sideways (t0). Everyone faces the front except t0.
function desk(id: string, x: number, y: number): Furniture {
  return { id, kind: 'desk', x, y, w: 1, h: 0.685, rotation: 180, flipH: false };
}
const furniture = [desk('R0', 0, 0), desk('R1', 1, 0), desk('R2', 2, 0), desk('R3', 3, 0), desk('C0', 5, 0), desk('F0', 9, 6), desk('T0', 9, 0)];
const seats: Seat[] = [
  ...[0, 1, 2, 3].map((i) => ({ id: `r${i}`, furnitureId: `R${i}`, x: i, y: 0.4, facing: 0 })),
  { id: 'c0', furnitureId: 'C0', x: 5, y: 0.4, facing: 0 },
  { id: 'f0', furnitureId: 'F0', x: 9, y: 6.4, facing: 0 },
  { id: 't0', furnitureId: 'T0', x: 9, y: 0.4, facing: 90 },
];

function student(id: string, level: Level, extra: { needs?: Needs; color?: number } = {}): Student {
  return { id, name: id, level, color: extra.color ?? null, needs: extra.needs ?? {} };
}

type Setup = {
  students: Student[];
  chart: Assignment;
  keepApart?: { a: string; b: string }[];
  balanceColors?: boolean;
  current?: Assignment;
  feedback?: { spreadOutOnes: 0 | 1 | 2; onesCloserToMe: 0 | 1 | 2; fewerOnesPerTable: 0 | 1 | 2 };
};

function score(setup: Setup, settings: EngineSettings = DEFAULT_SETTINGS): number {
  const room = buildRoom({
    seats,
    furniture,
    teacherSpots: [{ id: 'front', time: 'most', x: 1.5, y: -1 }],
    doors: [{ a: { x: 9.5, y: 7 }, b: { x: 10, y: 7 } }],
    settings,
  });
  const labels = Object.fromEntries(seats.map((s) => [s.id, 1 as Level]));
  return scoreSeating({ room, labels, ...setup }, setup.chart);
}

// What one rule adds: the score minus the score with that rule's cost set to 0.
function costOf(setup: Setup, change: (s: EngineSettings) => void): number {
  const without = structuredClone(DEFAULT_SETTINGS);
  change(without);
  return score(setup) - score(setup, without);
}

const must = (need: keyof Needs): Needs => ({ [need]: 'must' });

describe('each rule costs what its setting says', () => {
  it('two 1s next to each other: 60 a pair', () => {
    const setup = { students: [student('a', 1), student('b', 1)], chart: { r0: 'a', r1: 'b' } };
    expect(costOf(setup, (s) => (s.cost.onesSideBySide = 0))).toBeCloseTo(60);
  });

  it('a keep-apart pair next to each other at the same table: 220 + 70', () => {
    const setup = { students: [student('a', 3), student('b', 3)], chart: { r0: 'a', r1: 'b' }, keepApart: [{ a: 'a', b: 'b' }] };
    expect(costOf(setup, (s) => ((s.cost.keepApartNextTo = 0), (s.cost.keepApartSameTable = 0)))).toBeCloseTo(290);
  });

  it('a keep-apart pair just close by: 35', () => {
    const setup = { students: [student('a', 3), student('b', 3)], chart: { r3: 'a', c0: 'b' }, keepApart: [{ a: 'a', b: 'b' }] };
    expect(costOf(setup, (s) => (s.cost.keepApartClose = 0))).toBeCloseTo(35);
  });

  it('needs a helper, with no 3 next to them: 28 × 2.2', () => {
    const setup = { students: [student('a', 1, { needs: must('helper-nearby') }), student('b', 2)], chart: { r0: 'a', r1: 'b' } };
    expect(costOf(setup, (s) => (s.cost.helperMissing = 0))).toBeCloseTo(61.6);
  });

  it('needs fewer neighbors, with two: (6 × 2 + 4 × 1) × 2.2', () => {
    const students = [student('a', 3, { needs: must('fewer-neighbors') }), student('b', 3), student('c', 3)];
    const setup = { students, chart: { r1: 'a', r0: 'b', r2: 'c' } };
    expect(costOf(setup, (s) => ((s.cost.fewerNeighborsEach = 0), (s.cost.fewerNeighborsPair = 0)))).toBeCloseTo(35.2);
  });

  it('must face the front, sitting sideways: between 30 and 60 × 2.2', () => {
    const setup = { students: [student('a', 3, { needs: must('face-front') })], chart: { t0: 'a' } };
    const cost = costOf(setup, (s) => ((s.cost.faceFrontMin = 0), (s.cost.faceFrontMax = 0)));
    expect(cost).toBeGreaterThan(30 * 2.2);
    expect(cost).toBeLessThan(60 * 2.2);
  });

  it('must sit near the front, close to me or near the door: costs only far down the ranking', () => {
    for (const [need, key] of [
      ['near-front', 'nearFront'],
      ['close-to-teacher', 'closeToMe'],
    ] as const) {
      const far = { students: [student('a', 3, { needs: must(need) })], chart: { f0: 'a' } };
      const near = { students: [student('a', 3, { needs: must(need) })], chart: { r1: 'a' } };
      expect(costOf(far, (s) => (s.cost[key] = 0))).toBeGreaterThan(0);
      expect(costOf(near, (s) => (s.cost[key] = 0))).toBe(0);
    }
    const byDoor = { students: [student('a', 3, { needs: must('near-door') })], chart: { r0: 'a' } };
    expect(costOf(byDoor, (s) => (s.cost.nearDoor = 0))).toBeGreaterThan(0);
  });

  it('a group with no 3s: 16', () => {
    const setup = { students: [student('a', 2), student('b', 2)], chart: { r0: 'a', r3: 'b' } };
    expect(costOf(setup, (s) => (s.cost.groupWithoutThree = 0))).toBeCloseTo(16);
  });

  it('a group with more 1s than its cap: 8 each, or 22 with "Fewer 1s at each table"', () => {
    const students = [student('a', 1), student('b', 1), student('c', 1)];
    const setup = { students, chart: { r0: 'a', r2: 'b', r3: 'c' } };
    expect(costOf(setup, (s) => (s.cost.groupExtraOne = 0))).toBeCloseTo(8);
    const fewer = { ...setup, feedback: { spreadOutOnes: 0, onesCloserToMe: 0, fewerOnesPerTable: 1 } as const };
    expect(costOf(fewer, (s) => (s.feedback.fewerOnesExtraOne = [0, 0]))).toBeCloseTo(2 * 22);
  });

  it('same color next to each other: 3.5, only when balancing colors', () => {
    const students = [student('a', 3, { color: 0 }), student('b', 3, { color: 0 }), student('c', 3, { color: 1 })];
    const setup = { students, chart: { r0: 'a', r1: 'b', f0: 'c' } };
    expect(costOf({ ...setup, balanceColors: true }, (s) => (s.cost.sameColorNeighbors = 0))).toBeCloseTo(3.5);
    expect(costOf(setup, (s) => (s.cost.sameColorNeighbors = 0))).toBe(0);
  });

  it('a 2 next to a 1: 6 plus more the farther from the manager', () => {
    const setup = { students: [student('a', 1), student('b', 2)], chart: { r0: 'a', r1: 'b' } };
    const cost = costOf(setup, (s) => ((s.cost.oneBesideTwo = 0), (s.cost.oneBesideTwoFar = 0)));
    expect(cost).toBeGreaterThanOrEqual(6);
    expect(cost).toBeLessThanOrEqual(20);
  });

  it('level fit: a 1 in a 3 seat costs 90', () => {
    const room = buildRoom({ seats, furniture, teacherSpots: [] });
    const labels = { ...Object.fromEntries(seats.map((s) => [s.id, 1 as Level])), f0: 3 as Level };
    const inThree = scoreSeating({ room, labels, students: [student('a', 1)] }, { f0: 'a' });
    const inOne = scoreSeating({ room, labels: { ...labels, f0: 1 }, students: [student('a', 1)] }, { f0: 'a' });
    expect(inThree - inOne).toBeCloseTo(90);
  });
});

describe('shuffle and feedback costs', () => {
  it('staying in the same seat as the chart on screen: 32 each', () => {
    const setup = { students: [student('a', 3), student('b', 3)], chart: { r0: 'a', f0: 'b' }, current: { r0: 'a', f0: 'b' } };
    expect(costOf(setup, (s) => (s.history.current.sameSeat = 0))).toBeCloseTo(64);
  });

  it('"Spread out the 1s": 14 per click for two 1s close but not next to each other', () => {
    const setup = {
      students: [student('a', 1), student('b', 1)],
      chart: { r3: 'a', c0: 'b' },
      feedback: { spreadOutOnes: 2, onesCloserToMe: 0, fewerOnesPerTable: 0 } as const,
    };
    expect(costOf(setup, (s) => (s.feedback.spreadOnesPerLevel = 0))).toBeCloseTo(28);
  });

  it('"Keep 1s closer to me": 30 per click × how far the seat is', () => {
    const setup = {
      students: [student('a', 1)],
      chart: { f0: 'a' },
      feedback: { spreadOutOnes: 0, onesCloserToMe: 1, fewerOnesPerTable: 0 } as const,
    };
    const cost = costOf(setup, (s) => (s.feedback.onesCloserPerLevel = 0));
    expect(cost).toBeGreaterThan(20);
    expect(cost).toBeLessThanOrEqual(30);
  });
});
