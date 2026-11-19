// The worked example on a fixed 24-seat test layout: the manager's
// spots, the seat labels, the roster with needs, and the final chart.
import fixtures from '@test/fixtures/layouts.json';
import type { Layout } from '@modules/layouts/types';

import type { Assignment, KeepApart, Level, Needs, SeatLabels, Segment, Student, TeacherSpot } from '../types';

export const layout = (fixtures.layouts as Layout[]).find((l) => l.id === 'fixture-blocks-24')!;

export const teacherSpots: TeacherSpot[] = [
  { id: 'front', time: 'most', x: 2.892, y: 0.474 },
  { id: 'desk', time: 'sometimes', x: 10.3, y: 4.039 },
  { id: 'table', time: 'sometimes', x: 0.756, y: 7.399 },
];

// On the back wall, near the right corner.
export const doors: Segment[] = [{ a: { x: 9.3, y: 7.454 }, b: { x: 10.3, y: 7.454 } }];

export const guideLabels: SeatLabels = {
  s1: 1, s2: 3, s3: 3, s4: 1, s5: 1, s6: 2, s7: 1, s8: 3,
  s9: 3, s10: 3, s11: 1, s12: 1, s13: 1, s14: 3, s15: 1, s16: 2,
  s17: 3, s18: 2, s19: 2, s20: 3, s21: 3, s22: 2, s23: 3, s24: 2,
};

const PINK = 0;
const BLUE = 1;

function student(name: string, level: Level, color: number, needs: Needs = {}): Student {
  return { id: name, name, level, color, needs };
}

// Michael ("needs a friend") and Monica ("won't be distracted by goofing off")
// only have private notes, which the engine doesn't read.
export const students: Student[] = [
  student('Nora', 1, PINK, { 'fewer-neighbors': 'must' }),
  student('Leo', 1, PINK),
  student('Isabella', 1, PINK, { 'helper-nearby': 'must' }),
  student('Theo', 1, BLUE),
  student('Anna-Sofia', 1, BLUE, { 'near-front': 'must' }),
  student('Mateo', 1, BLUE, { 'near-front': 'must' }),
  student('Eli', 1, BLUE, { 'helper-nearby': 'must' }),
  student('Valeria', 2, PINK, { 'near-front': 'must' }),
  student('Zoe', 2, PINK, { 'helper-nearby': 'must' }),
  student('Hazel', 2, PINK),
  student('Ava', 2, PINK),
  student('Benjamin', 2, BLUE),
  student('Samuel', 2, BLUE),
  student('Lucia', 3, PINK),
  student('Camila', 3, PINK),
  student('Emma', 3, PINK),
  student('Mia', 3, PINK),
  student('Ivy', 3, PINK),
  student('Olivia', 3, PINK),
  student('Max', 3, BLUE),
  student('Noah', 3, BLUE),
  student('Sam', 3, BLUE),
  student('Diego', 3, BLUE),
  student('Liam', 3, BLUE),
];

export const guideChart: Assignment = {
  s1: 'Nora', s2: 'Camila', s3: 'Max', s4: 'Mateo', s5: 'Theo', s6: 'Valeria',
  s7: 'Anna-Sofia', s8: 'Lucia', s9: 'Emma', s10: 'Noah', s11: 'Eli', s12: 'Isabella',
  s13: 'Leo', s14: 'Mia', s15: 'Zoe', s16: 'Benjamin', s17: 'Ivy', s18: 'Olivia',
  s19: 'Samuel', s20: 'Liam', s21: 'Sam', s22: 'Hazel', s23: 'Diego', s24: 'Ava',
};

export const keepJimAndKellyApart: KeepApart[] = [{ a: 'Eli', b: 'Nora' }];
