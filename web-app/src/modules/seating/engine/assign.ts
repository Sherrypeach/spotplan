import { EMPTY, Scorer } from './scoring';
import type { ScoreInput } from './scoring';
import { search, seededRandom } from './search';
import type { SearchPlan } from './search';
import type { Assignment, Student } from './types';
import { levelOrThree } from './types';

export type SeatingInput = ScoreInput & {
  // Students the teacher locked in place: seat id to student id.
  locked?: Assignment;
};

export type SeatingOptions = {
  seed?: number;
  // Fewer moves or runs than the defaults, for quick previews and tests.
  moves?: number;
  runs?: number;
};

export type SeatingResult = {
  assignment: Assignment;
  // Students without a seat because the room is short.
  unseated: string[];
  // Locks that couldn't be kept: the seat or student no longer exists, or the
  // student was locked to more than one seat.
  droppedLocks: Assignment;
};

const hasMustNeed = (s: Student) => Object.values(s.needs).includes('must');

// The method's order: 1s and students with Must needs first, then 2s, then 3s.
function priorityOrder(students: Student[], random: () => number): number[] {
  const rank = (s: Student) => (s.level === 1 || hasMustNeed(s) ? 0 : levelOrThree(s));
  return students
    .map((student, index) => ({ index, rank: rank(student), tieBreak: random() }))
    .sort((a, b) => a.rank - b.rank || a.tieBreak - b.tieBreak)
    .map(({ index }) => index);
}

function lockedStudents(input: SeatingInput): { locked: Map<number, number>; dropped: Assignment } {
  const studentIndex = new Map(input.students.map((s, i) => [s.id, i]));
  const locked = new Map<number, number>();
  const dropped: Assignment = {};
  for (const [seatId, studentId] of Object.entries(input.locked ?? {})) {
    const seat = input.room.seatIndex.get(seatId);
    const student = studentIndex.get(studentId);
    if (seat === undefined || student === undefined || locked.has(student)) dropped[seatId] = studentId;
    else locked.set(student, seat);
  }
  return { locked, dropped };
}

function run(input: SeatingInput, options: SeatingOptions, shuffle: boolean): SeatingResult {
  const random = seededRandom(options.seed ?? 1);
  const { search: settings } = input.room.settings;
  const noise = shuffle ? () => random() * settings.shuffleNoise : undefined;
  const scorer = new Scorer(input.room, input, noise);
  const movesForClass = settings.movesPerStudent * input.students.length;
  const { locked, dropped } = lockedStudents(input);
  const plan: SearchPlan = {
    random,
    locked,
    priority: priorityOrder(input.students, random),
    startFrom: shuffle ? 'random' : 'greedy',
    runs: options.runs ?? settings.runs,
    moves: options.moves ?? Math.min(settings.maxMoves, Math.max(settings.minMoves, movesForClass)),
    startTemperature: settings.startTemperature,
    endTemperature: settings.endTemperature,
  };
  search(scorer, plan);
  const assignment = scorer.toAssignment();
  const seated = new Set(Object.values(assignment));
  const unseated = input.students.filter((s) => !seated.has(s.id)).map((s) => s.id);
  return { assignment, unseated, droppedLocks: dropped };
}

export function placeStudents(input: SeatingInput, options: SeatingOptions = {}): SeatingResult {
  return run(input, options, false);
}

// New seats in the same layout, by the same rules, steering away from the
// chart on screen (`current`) and recent saved charts. Locked students stay.
export function shuffleStudents(input: SeatingInput, options: SeatingOptions = {}): SeatingResult {
  return run(input, options, true);
}

export function scoreSeating(input: SeatingInput, assignment: Assignment): number {
  const scorer = new Scorer(input.room, input);
  const studentIndex = new Map(input.students.map((s, i) => [s.id, i]));
  for (const [seatId, studentId] of Object.entries(assignment)) {
    const seat = input.room.seatIndex.get(seatId);
    const student = studentIndex.get(studentId);
    const free = seat !== undefined && student !== undefined && scorer.studentAt[seat] === EMPTY;
    if (free && scorer.seatOf[student] === EMPTY) scorer.place(student, seat);
  }
  return scorer.total();
}
