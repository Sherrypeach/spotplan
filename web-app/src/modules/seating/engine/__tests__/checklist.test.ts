import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { Layout } from '@modules/layouts/types';

import { buildRoom, checkSeating, labelCounts, placeStudents, problemTotal, shuffleStudents, suggestSeatLabels, suggestSwaps } from '..';
import type { Assignment, Student } from '..';
import { doors, guideChart, guideLabels, keepJimAndKellyApart, layout, students, teacherSpots } from './workedExample';

const room = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots, doors });
const input = { room, students, labels: guideLabels, keepApart: keepJimAndKellyApart };
const sameProblem = (i: { kind: string; need?: string; studentIds: string[] }) =>
  [i.kind, i.need ?? '', [...i.studentIds].sort().join(',')].join('|');

describe('check list tiers', () => {
  it('puts an unmet Must under "Needs attention" and an unmet Nice to have in its own tier', () => {
    const chart: Assignment = { ...guideChart, s4: 'Liam', s20: 'Mateo' };
    const dwight = checkSeating(input, chart).find((i) => i.studentIds.includes('Mateo') && i.need === 'near-front');
    expect(dwight?.tier).toBe('attention');
    const nice = students.map((s) => (s.id === 'Mateo' ? { ...s, needs: { 'near-front': 'nice' as const } } : s));
    const relaxed = checkSeating({ ...input, students: nice }, chart).find(
      (i) => i.studentIds.includes('Mateo') && i.need === 'near-front',
    );
    expect(relaxed?.tier).toBe('nice');
  });

  it('flags a 2 in a 3 seat and a group with no 3s as worth a look', () => {
    const chart: Assignment = { ...guideChart, s14: 'Samuel', s19: 'Mia' };
    const kinds = checkSeating(input, chart).filter((i) => i.tier === 'look').map((i) => i.kind);
    expect(kinds).toContain('two-in-three-seat');
    expect(kinds).toContain('group-without-three');
  });

  it('counts checked-off items as nothing', () => {
    const chart: Assignment = { ...guideChart, s4: 'Liam', s20: 'Mateo' };
    const items = checkSeating(input, chart);
    const all = problemTotal(room, items);
    const checked = new Set(items.filter((i) => i.tier === 'attention').map((i) => i.key));
    expect(problemTotal(room, items, checked)).toBe(all - 10 * checked.size);
  });

  it('asks for a door when someone needs one and none is drawn', () => {
    const noDoor = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots });
    const needsDoor = students.map((s) => (s.id === 'Ivy' ? { ...s, needs: { 'near-door': 'must' as const } } : s));
    const items = checkSeating({ room: noDoor, students: needsDoor, labels: guideLabels }, guideChart);
    expect(items.map((i) => i.kind)).toContain('no-door');
  });
});

describe('swap suggestions', () => {
  it('only suggests swaps after which the clicked problem is really gone', () => {
    const chart: Assignment = { ...guideChart, s14: 'Samuel', s19: 'Mia' };
    const problem = checkSeating(input, chart).find((i) => i.kind === 'two-in-three-seat')!;
    const suggestions = suggestSwaps(input, chart, problem);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      const [a, b] = s.seatIds;
      if (a === null) throw new Error('every teammate here has a seat');
      const next = { ...chart, [a]: chart[b], [b]: chart[a] };
      expect(checkSeating(input, next).map(sameProblem)).not.toContain(sameProblem(problem));
    }
  });

  it('offers an empty seat to a teammate who has none', () => {
    const seats = Object.keys(guideChart);
    const [emptySeat] = seats;
    const unseated = guideChart[emptySeat];
    const chart: Assignment = { ...guideChart };
    delete chart[emptySeat];
    const problem = checkSeating(input, chart).find((i) => i.kind === 'unseated')!;
    const [first] = suggestSwaps(input, chart, problem);
    expect(first).toMatchObject({ seatIds: [null, emptySeat], studentIds: [unseated] });
  });

  it('never suggests anything for problems about the room', () => {
    const problem = { key: 'k', tier: 'attention' as const, kind: 'too-few-front-seats' as const, studentIds: ['Nora'], seatIds: [] };
    expect(suggestSwaps(input, guideChart, problem)).toEqual([]);
  });
});

describe('search details', () => {
  const labels = suggestSeatLabels(room, labelCounts(room, students));
  const base = { room, students, labels, keepApart: keepJimAndKellyApart };

  it('starts better from the greedy placement than from a random one', () => {
    const greedy = placeStudents(base, { moves: 0, runs: 1 });
    const random = shuffleStudents(base, { moves: 0, runs: 1 });
    const total = (chart: Record<string, string>) => problemTotal(room, checkSeating(base, chart));
    expect(total(greedy.assignment)).toBeLessThan(total(random.assignment));
  });

  it('reports locks it couldn’t keep', () => {
    const result = placeStudents({ ...base, locked: { gone: 'Nora', s9: 'Nobody' } }, { moves: 0, runs: 1 });
    expect(result.droppedLocks).toEqual({ gone: 'Nora', s9: 'Nobody' });
  });

  it('makes one spare 1 seat for a couple of 1s', () => {
    const two: Student[] = students.filter((s) => s.level !== 1).concat(students.filter((s) => s.level === 1).slice(0, 2));
    expect(labelCounts(room, two)[1]).toBe(3);
  });
});

describe('next to, across the library', () => {
  it('never links seats at a right angle', () => {
    for (const l of library.layouts as Layout[]) {
      const r = buildRoom({ seats: l.seats, furniture: l.furniture, teacherSpots: [] });
      r.neighbors.forEach((list, a) =>
        list.forEach((b) => {
          const turn = Math.abs(Math.cos(((r.seats[a].facing - r.seats[b].facing) * Math.PI) / 180));
          if (l.category !== 'carpets') expect(turn).toBeGreaterThanOrEqual(0.35);
        }),
      );
    }
  });
});
