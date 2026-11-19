import type { ClassroomDocument, DocRoom, SeatAssignment } from '@modules/classroom/document';
import type { Furniture, Seat } from '@modules/layouts/types';
import { deskUnit, isLayoutPiece } from '@modules/room/roomGroups';
import { toFrontUp } from '@modules/room/frontFrame';
import { doorSegments } from '@modules/room/wallFeatures';
import {
  buildRoom,
  checkSeating,
  labelCounts,
  needMet,
  placeStudents,
  shuffleStudents,
  suggestSeatLabels,
  suggestSwaps,
  type CheckInput,
  type CheckItem,
  type Feedback,
  type Level,
  type NeedKind,
  type Room,
  type SeatingInput,
  type SeatLabels,
  type SwapSuggestion,
  type Student,
} from '@modules/seating/engine';

// "Not quite right?" buttons go off, on, stronger, then off again.
const FEEDBACK_STEPS = 3;
// Shuffle seeds stay small, like the engine's own.
const SEED_RANGE = 100000;

/** The engine's view of the room: the layout's seats, with the teacher at the front unless the teacher marked spots. */
/** The room as the seating engine sees it: turned so the board's wall is the front, at the top. */
export function engineRoom(drawn: Pick<DocRoom, 'seats' | 'pieces' | 'spots' | 'layout' | 'width' | 'depth' | 'front'>): Room {
  const room = toFrontUp(drawn);
  return buildRoom({
    seats: room.seats as Seat[],
    furniture: room.pieces.filter((piece) => isLayoutPiece(piece.id)) as unknown as Furniture[],
    teacherSpots: room.spots.map((spot) => ({ id: spot.id, x: spot.x, y: spot.y, time: spot.time })),
    deskWidth: deskUnit(room),
    frontY: 0,
    doors: doorSegments(room),
  });
}

function engineStudents(doc: ClassroomDocument): Student[] {
  return doc.students.map((student) => ({
    id: student.id,
    name: student.name,
    level: student.level,
    // A tag that's switched off, or colors turned off, isn't balanced.
    color: student.color !== null && doc.colors.enabled && doc.colors.tags[student.color]?.inUse ? student.color : null,
    needs: student.needs,
  }));
}

function handSet(room: DocRoom): SeatLabels {
  return Object.fromEntries(room.handSetLabels.filter((id) => room.labels[id]).map((id) => [id, room.labels[id]]));
}

/** Every seat's label: the ones set by hand, the suggestions for the rest. */
export function seatLabels(doc: ClassroomDocument, room: Room): SeatLabels {
  return suggestSeatLabels(room, labelCounts(room, engineStudents(doc)), handSet(doc.room));
}

/** A label picked by hand; it stays when the room or the class changes. */
/** A seat's label; seats the engine hasn't labeled count as 3s, like unleveled students. */
export function labelOf(labels: SeatLabels, seatId: string): Level {
  return labels[seatId] ?? 3;
}

export function unlockAll(doc: ClassroomDocument): ClassroomDocument {
  return { ...doc, seating: { ...doc.seating, lockedSeats: [] } };
}

export function setLabel(doc: ClassroomDocument, seatId: string, next: Level): ClassroomDocument {
  return {
    ...doc,
    room: {
      ...doc.room,
      labels: { ...doc.room.labels, [seatId]: next },
      handSetLabels: [...doc.room.handSetLabels.filter((id) => id !== seatId), seatId],
    },
  };
}

export function resetLabels(doc: ClassroomDocument): ClassroomDocument {
  return { ...doc, room: { ...doc.room, labels: {}, handSetLabels: [] } };
}

/** Whether a student of `level` belongs in a seat labeled `label`: 3s go anywhere, 2s may take a spare 1 seat. */
export function fits(level: Level, label: Level): boolean {
  return level === 3 || level === label || (level === 2 && label === 1);
}

/** The chart without seats or students that no longer exist. */
export function currentAssignment(doc: ClassroomDocument): SeatAssignment {
  const seats = new Set(doc.room.seats.map((seat) => seat.id));
  const students = new Set(doc.students.map((student) => student.id));
  const seen = new Set<string>();
  const clean: SeatAssignment = {};
  for (const [seatId, studentId] of Object.entries(doc.seating.assignment)) {
    if (!seats.has(seatId) || !students.has(studentId) || seen.has(studentId)) continue;
    seen.add(studentId);
    clean[seatId] = studentId;
  }
  return clean;
}

export function lockedAssignment(doc: ClassroomDocument): SeatAssignment {
  const assignment = currentAssignment(doc);
  return Object.fromEntries(doc.seating.lockedSeats.filter((seat) => assignment[seat]).map((seat) => [seat, assignment[seat]]));
}

export function feedbackOf(doc: ClassroomDocument): Feedback {
  const value = (key: keyof Feedback) => {
    const raw = Number(doc.settings.feedback?.[key]);
    return Math.min(FEEDBACK_STEPS - 1, Math.max(0, Number.isFinite(raw) ? Math.round(raw) : 0)) as 0 | 1 | 2;
  };
  return { spreadOutOnes: value('spreadOutOnes'), onesCloserToMe: value('onesCloserToMe'), fewerOnesPerTable: value('fewerOnesPerTable') };
}

export function checkInput(doc: ClassroomDocument, room: Room): CheckInput {
  return { room, students: engineStudents(doc), labels: seatLabels(doc, room), keepApart: doc.keepApart };
}

function seatingInput(doc: ClassroomDocument, room: Room): SeatingInput {
  return {
    ...checkInput(doc, room),
    feedback: feedbackOf(doc),
    balanceColors: doc.colors.enabled && doc.settings.balanceColors,
    locked: lockedAssignment(doc),
  };
}

/** A shuffle also steers away from the chart on screen and the saved charts of this layout. */
function shuffleInput(doc: ClassroomDocument, room: Room): SeatingInput {
  const saved = doc.settings.usePastCharts
    ? [...doc.savedCharts]
        .filter((chart) => chart.layoutId === doc.room.layout?.id)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map((chart) => chart.assignment)
    : [];
  return { ...seatingInput(doc, room), current: currentAssignment(doc), saved };
}

function withAssignment(doc: ClassroomDocument, assignment: SeatAssignment): ClassroomDocument {
  return { ...doc, seating: { ...doc.seating, assignment, lockedSeats: doc.seating.lockedSeats.filter((seat) => assignment[seat]) } };
}

/** Seats the whole class by the method; locked students stay where they are. */
export function placeAll(doc: ClassroomDocument, room: Room): ClassroomDocument {
  return withAssignment(doc, placeStudents(seatingInput(doc, room)).assignment);
}

/** New seats in the same layout, by the same rules, away from the chart on screen. */
export function shuffleAll(doc: ClassroomDocument, room: Room, seed = Date.now()): ClassroomDocument {
  return withAssignment(doc, shuffleStudents(shuffleInput(doc, room), { seed: seed % SEED_RANGE }).assignment);
}

/** Puts a student in a seat; whoever sat there goes to the student's old seat, or to Unseated. */
export function moveStudent(doc: ClassroomDocument, studentId: string, toSeat: string): ClassroomDocument {
  const assignment = currentAssignment(doc);
  const fromSeat = Object.keys(assignment).find((seat) => assignment[seat] === studentId);
  if (fromSeat === toSeat) return doc;
  const other = assignment[toSeat];
  const next = { ...assignment, [toSeat]: studentId };
  if (fromSeat) delete next[fromSeat];
  if (fromSeat && other) next[fromSeat] = other;
  const locked = doc.seating.lockedSeats.filter((seat) => seat !== toSeat && seat !== fromSeat);
  return { ...doc, seating: { ...doc.seating, assignment: next, lockedSeats: locked } };
}

export function unseat(doc: ClassroomDocument, studentId: string): ClassroomDocument {
  const assignment = currentAssignment(doc);
  const seat = Object.keys(assignment).find((id) => assignment[id] === studentId);
  if (!seat) return doc;
  delete assignment[seat];
  return { ...doc, seating: { ...doc.seating, assignment, lockedSeats: doc.seating.lockedSeats.filter((id) => id !== seat) } };
}

export function toggleLock(doc: ClassroomDocument, seatId: string): ClassroomDocument {
  const locked = doc.seating.lockedSeats.includes(seatId)
    ? doc.seating.lockedSeats.filter((id) => id !== seatId)
    : [...doc.seating.lockedSeats, seatId];
  return { ...doc, seating: { ...doc.seating, lockedSeats: locked } };
}

export function swapSeats(doc: ClassroomDocument, seatA: string, seatB: string): ClassroomDocument {
  const assignment = currentAssignment(doc);
  const a = assignment[seatA];
  const b = assignment[seatB];
  if (a) return moveStudent(doc, a, seatB);
  if (b) return moveStudent(doc, b, seatA);
  return doc;
}

/** Who sits right next to a student, and which of their needs this seat meets. */
export function studentDetails(doc: ClassroomDocument, room: Room, studentId: string) {
  const assignment = currentAssignment(doc);
  const seatId = Object.keys(assignment).find((seat) => assignment[seat] === studentId);
  const seat = seatId === undefined ? undefined : room.seatIndex.get(seatId);
  const students = engineStudents(doc);
  const byId = new Map(students.map((student) => [student.id, student]));
  const student = byId.get(studentId);
  if (seat === undefined || !student) return { neighbors: [], needs: [] };
  const neighbors = room.neighbors[seat]
    .map((other) => byId.get(assignment[room.seats[other].id]))
    .filter((other): other is Student => other !== undefined)
    .map((other) => ({ id: other.id, name: other.name, level: other.level }));
  const needs = (Object.keys(student.needs) as NeedKind[]).map((need) => ({ need, met: needMet(room, assignment, byId, seat, need) }));
  return { neighbors, needs };
}

/** Makes a suggested swap, or seats a student who had no seat. */
export function applySuggestion(doc: ClassroomDocument, suggestion: SwapSuggestion): ClassroomDocument {
  const [from, to] = suggestion.seatIds;
  return from === null ? moveStudent(doc, suggestion.studentIds[0], to) : swapSeats(doc, from, to);
}

/** The check list for the chart on screen. */
export function checks(doc: ClassroomDocument, room: Room): CheckItem[] {
  return checkSeating(checkInput(doc, room), currentAssignment(doc));
}

// Each fix makes the class strictly better, so this only caps a very long run.
const MAX_FIXES = 50;

/** Makes the best safe swap, again and again, until no swap helps. Locked seats and checked-off items stay as they are. */
export function fixAll(doc: ClassroomDocument, room: Room): ClassroomDocument {
  let current = doc;
  for (let fix = 0; fix < MAX_FIXES; fix += 1) {
    const input = checkInput(current, room);
    const assignment = currentAssignment(current);
    const checkedOff = new Set(current.seating.checkedOff);
    const options = { locked: lockedAssignment(current), checkedOff };
    const open = checkSeating(input, assignment).filter((item) => !checkedOff.has(item.key));
    let swap: SwapSuggestion | undefined;
    for (const item of open) {
      swap = suggestSwaps(input, assignment, item, options)[0];
      if (swap) break;
    }
    if (!swap) break;
    current = applySuggestion(current, swap);
  }
  return current;
}

/** Checks an item off, or back on. Only items still on the list are kept, so the list never grows past it. */
export function toggleCheckedOff(doc: ClassroomDocument, room: Room, key: string): ClassroomDocument {
  const current = new Set(checks(doc, room).map((item) => item.key));
  const kept = doc.seating.checkedOff.filter((k) => current.has(k));
  const checkedOff = kept.includes(key) ? kept.filter((k) => k !== key) : [...kept, key];
  return { ...doc, seating: { ...doc.seating, checkedOff } };
}

/** "Not quite right?": each click makes the rule stronger, the third turns it off; then the class is seated again. */
export function nudgeFeedback(doc: ClassroomDocument, room: Room, key: keyof Feedback): ClassroomDocument {
  const now = feedbackOf(doc)[key];
  const next: ClassroomDocument = { ...doc, settings: { ...doc.settings, feedback: { ...doc.settings.feedback, [key]: (now + 1) % FEEDBACK_STEPS } } };
  return placeAll(next, room);
}
