import type { Room } from './room';
import type { Assignment, KeepApart, NeedKind, SeatLabels, Student } from './types';
import { levelOrThree } from './types';

export type Tier = 'attention' | 'look' | 'nice';

export type CheckKind =
  // Needs attention
  | 'more-students-than-seats'
  | 'no-level'
  | 'unseated'
  | 'one-outside-one-seat'
  | 'must-need-unmet'
  | 'ones-side-by-side'
  | 'keep-apart-together'
  | 'too-few-front-seats'
  // Worth a look
  | 'two-in-three-seat'
  | 'two-beside-one-far'
  | 'group-mostly-ones'
  | 'group-without-three'
  | 'no-door'
  // Nice-to-haves not met
  | 'nice-need-unmet'
  | 'front-seats-short-for-nice';

export type CheckItem = {
  // Ties an item to these students in these seats, so a checked-off item comes
  // back if the problem shows up somewhere else.
  key: string;
  tier: Tier;
  kind: CheckKind;
  studentIds: string[];
  seatIds: string[];
  need?: NeedKind;
  // Numbers for the sentence, e.g. front-facing seats vs. students who need one.
  counts?: { have: number; need: number; wouldLike?: number };
};

export type CheckInput = {
  room: Room;
  students: Student[];
  labels: SeatLabels;
  keepApart?: KeepApart[];
};

const MINOR_LOOKS: CheckKind[] = ['no-door'];
// One per class, naming everyone with a need: keyed without the names so the
// key stays short (the API stores keys of up to 300 characters).
const CLASS_WIDE: CheckKind[] = ['too-few-front-seats', 'front-seats-short-for-nice', 'no-door'];

function item(tier: Tier, kind: CheckKind, studentIds: string[], seatIds: string[], extra: Partial<CheckItem> = {}): CheckItem {
  const named = CLASS_WIDE.includes(kind) ? '' : [...studentIds].sort().join(',');
  const key = [kind, extra.need ?? '', named, [...seatIds].sort().join(',')].join('|');
  return { key, tier, kind, studentIds, seatIds, ...extra };
}

// Whether a seat meets a need, by the check list's thresholds.
export function needMet(room: Room, assignment: Assignment, studentsById: Map<string, Student>, seat: number, need: NeedKind): boolean | null {
  const c = room.settings.checklist;
  const nextTo = room.neighbors[seat].map((n) => studentsById.get(assignment[room.seats[n].id])).filter((s): s is Student => !!s);
  switch (need) {
    case 'near-front':
      return room.frontRank[seat] <= c.nearFrontShare;
    case 'face-front':
      return room.facesFront[seat];
    case 'close-to-teacher':
      return room.closenessRank[seat] <= c.closeToMeShare;
    case 'near-door':
      return room.doorRank ? room.doorRank[seat] <= c.nearDoorShare : null;
    case 'helper-nearby':
      return nextTo.some((s) => levelOrThree(s) === 3);
    case 'fewer-neighbors':
      return nextTo.length <= c.fewerNeighborsMax;
  }
}

function frontSeatItems(input: CheckInput): CheckItem[] {
  const fronts = input.room.facesFront.filter(Boolean).length;
  const must = input.students.filter((s) => s.needs['face-front'] === 'must');
  const nice = input.students.filter((s) => s.needs['face-front'] === 'nice');
  const counts = { have: fronts, need: must.length, wouldLike: nice.length };
  if (must.length > fronts) return [item('attention', 'too-few-front-seats', must.map((s) => s.id), [], { counts })];
  if (must.length + nice.length > fronts) {
    return [item('nice', 'front-seats-short-for-nice', nice.map((s) => s.id), [], { counts })];
  }
  return [];
}

function studentItems(input: CheckInput, assignment: Assignment, seatOf: Map<string, number>): CheckItem[] {
  const { room, labels } = input;
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const items: CheckItem[] = [];
  for (const student of input.students) {
    if (student.level === null) items.push(item('attention', 'no-level', [student.id], []));
    const seat = seatOf.get(student.id);
    if (seat === undefined) {
      items.push(item('attention', 'unseated', [student.id], []));
      continue;
    }
    const seatId = room.seats[seat].id;
    const label = labels[seatId] ?? 3;
    if (student.level === 1 && label !== 1) items.push(item('attention', 'one-outside-one-seat', [student.id], [seatId]));
    if (student.level === 2 && label === 3) items.push(item('look', 'two-in-three-seat', [student.id], [seatId]));
    for (const [need, strength] of Object.entries(student.needs) as [NeedKind, 'must' | 'nice'][]) {
      if (needMet(room, assignment, byId, seat, need) !== false) continue;
      const kind = strength === 'must' ? 'must-need-unmet' : 'nice-need-unmet';
      items.push(item(strength === 'must' ? 'attention' : 'nice', kind, [student.id], [seatId], { need }));
    }
  }
  if (!room.doorRank) {
    const needDoor = input.students.filter((s) => s.needs['near-door']);
    if (needDoor.length > 0) items.push(item('look', 'no-door', needDoor.map((s) => s.id), []));
  }
  return items;
}

function pairItems(input: CheckInput, assignment: Assignment, seatOf: Map<string, number>): CheckItem[] {
  const { room } = input;
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const items: CheckItem[] = [];
  room.neighbors.forEach((list, a) => {
    for (const b of list) {
      if (b < a) continue;
      const seatA = room.seats[a];
      const seatB = room.seats[b];
      const studentA = byId.get(assignment[seatA.id]);
      const studentB = byId.get(assignment[seatB.id]);
      if (!studentA || !studentB) continue;
      const ids = [studentA.id, studentB.id];
      const seats = [seatA.id, seatB.id];
      if (studentA.level === 1 && studentB.level === 1) items.push(item('attention', 'ones-side-by-side', ids, seats));
      const oneAndTwo = (studentA.level === 1 && studentB.level === 2) || (studentA.level === 2 && studentB.level === 1);
      if (oneAndTwo && (seatA.closeness + seatB.closeness) / 2 < room.settings.closeness.farBelow) {
        items.push(item('look', 'two-beside-one-far', ids, seats));
      }
    }
  });
  for (const pair of input.keepApart ?? []) {
    const a = seatOf.get(pair.a);
    const b = seatOf.get(pair.b);
    if (a === undefined || b === undefined) continue;
    const sameTable = room.groupOf[a] >= 0 && room.groupOf[a] === room.groupOf[b];
    if (room.neighbors[a].includes(b) || sameTable) {
      items.push(item('attention', 'keep-apart-together', [pair.a, pair.b], [room.seats[a].id, room.seats[b].id]));
    }
  }
  return items;
}

function groupItems(input: CheckInput, assignment: Assignment): CheckItem[] {
  const { room } = input;
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const items: CheckItem[] = [];
  for (const group of room.groups) {
    const seated = group
      .map((t) => ({ seatId: room.seats[t].id, student: byId.get(assignment[room.seats[t].id]) }))
      .filter((m): m is { seatId: string; student: Student } => !!m.student);
    if (seated.length < 2) continue;
    const ids = seated.map((m) => m.student.id);
    const seats = seated.map((m) => m.seatId);
    const ones = seated.filter((m) => m.student.level === 1).length;
    if (ones > group.length / 2) items.push(item('look', 'group-mostly-ones', ids, seats));
    if (!seated.some((m) => levelOrThree(m.student) === 3)) items.push(item('look', 'group-without-three', ids, seats));
  }
  return items;
}

// Everything worth telling the teacher about a seating, in three tiers.
export function checkSeating(input: CheckInput, assignment: Assignment): CheckItem[] {
  const seatOf = new Map<string, number>();
  for (const [seatId, studentId] of Object.entries(assignment)) {
    const seat = input.room.seatIndex.get(seatId);
    if (seat !== undefined && !seatOf.has(studentId)) seatOf.set(studentId, seat);
  }
  const items: CheckItem[] = [];
  if (input.students.length > input.room.seats.length) {
    items.push(item('attention', 'more-students-than-seats', [], [], {
      counts: { have: input.room.seats.length, need: input.students.length },
    }));
  }
  items.push(...frontSeatItems(input));
  items.push(...studentItems(input, assignment, seatOf));
  items.push(...pairItems(input, assignment, seatOf));
  items.push(...groupItems(input, assignment));
  return items;
}

// How much a list of problems weighs, ignoring items the teacher checked off.
export function problemTotal(room: Room, items: CheckItem[], checkedOff: Set<string> = new Set()): number {
  const weights = room.settings.checklist.tierWeight;
  return items.reduce((total, i) => {
    if (checkedOff.has(i.key)) return total;
    if (i.tier === 'attention') return total + weights.attention;
    if (i.tier === 'nice') return total + weights.nice;
    return total + (MINOR_LOOKS.includes(i.kind) ? weights.minorLook : weights.look);
  }, 0);
}
