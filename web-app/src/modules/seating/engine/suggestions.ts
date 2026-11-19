import { checkSeating, problemTotal } from './checklist';
import type { CheckInput, CheckItem } from './checklist';
import type { Assignment } from './types';

export type SwapSuggestion = {
  // Seats whose occupants trade places; the second may be empty (a move).
  // The first is null when an unseated student takes the second seat.
  seatIds: [string | null, string];
  studentIds: string[];
  // Problems the swap causes that weren't there before.
  newProblems: CheckItem[];
  total: number;
};

const MAX_SUGGESTIONS = 3;
// Problems about the room, not a seat: the screen links to the step or the
// layouts that fix them instead.
const ROOM_PROBLEMS: CheckItem['kind'][] = [
  'more-students-than-seats',
  'too-few-front-seats',
  'front-seats-short-for-nice',
  'no-door',
  // A level is set in Students; no seat change fixes it.
  'no-level',
];

// The same problem for the same students, wherever they sit.
function sameProblem(item: CheckItem): string {
  return [item.kind, item.need ?? '', [...item.studentIds].sort().join(',')].join('|');
}

function swapped(assignment: Assignment, seatA: string, seatB: string): Assignment {
  const next = { ...assignment };
  const a = assignment[seatA];
  const b = assignment[seatB];
  if (b) next[seatA] = b;
  else delete next[seatA];
  if (a) next[seatB] = a;
  else delete next[seatB];
  return next;
}

/**
 * Swaps or moves that fix a problem about a student. A swap is suggested only
 * if the class ends up better off overall and it adds no new problem that
 * needs attention, so it never trades one Must problem for another. Empty when
 * no single swap helps, which the screen should say plainly.
 */
export function suggestSwaps(
  input: CheckInput,
  assignment: Assignment,
  problem: CheckItem,
  options: { locked?: Assignment; checkedOff?: Set<string> } = {},
): SwapSuggestion[] {
  const { room } = input;
  if (ROOM_PROBLEMS.includes(problem.kind)) return [];
  const locked = new Set(Object.keys(options.locked ?? {}));
  const before = checkSeating(input, assignment);
  const beforeProblems = new Set(before.map(sameProblem));
  const target = sameProblem(problem);
  const beforeTotal = problemTotal(room, before, options.checkedOff);
  const seatOf = new Map(Object.entries(assignment).map(([seat, student]) => [student, seat]));

  const candidates: SwapSuggestion[] = [];
  const tried = new Set<string>();
  for (const studentId of problem.studentIds) {
    const from = seatOf.get(studentId);
    if (!from) {
      // Not seated: try each empty seat.
      for (const seat of room.seats) {
        if (assignment[seat.id] || locked.has(seat.id)) continue;
        const after = checkSeating(input, { ...assignment, [seat.id]: studentId });
        if (after.some((i) => sameProblem(i) === target)) continue;
        const newProblems = after.filter((i) => !beforeProblems.has(sameProblem(i)));
        if (newProblems.some((i) => i.tier === 'attention')) continue;
        const total = problemTotal(room, after, options.checkedOff);
        if (total < beforeTotal) candidates.push({ seatIds: [null, seat.id], studentIds: [studentId], newProblems, total });
      }
      continue;
    }
    if (locked.has(from)) continue;
    for (const seat of room.seats) {
      const pair = [from, seat.id].sort().join('|');
      if (seat.id === from || locked.has(seat.id) || tried.has(pair)) continue;
      tried.add(pair);
      const next = swapped(assignment, from, seat.id);
      const after = checkSeating(input, next);
      if (after.some((i) => sameProblem(i) === target)) continue;
      const newProblems = after.filter((i) => !beforeProblems.has(sameProblem(i)));
      if (newProblems.some((i) => i.tier === 'attention')) continue;
      const total = problemTotal(room, after, options.checkedOff);
      if (total >= beforeTotal) continue;
      const studentIds = [assignment[from], assignment[seat.id]].filter(Boolean);
      candidates.push({ seatIds: [from, seat.id], studentIds, newProblems, total });
    }
  }
  return candidates
    .sort((a, b) => a.total - b.total || a.newProblems.length - b.newProblems.length)
    .slice(0, MAX_SUGGESTIONS);
}
