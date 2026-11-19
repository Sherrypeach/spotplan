import type { ClassroomDocument, DocRoom } from '@modules/classroom/document';
import type { Layout } from '@modules/layouts/types';
import { chooseLayout, piecesOverlapping } from '@modules/room/layoutPlacement';
import { engineRoom } from '@modules/seats/seatingModel';
import { count } from '@shared/text';

/** How a layout does in this room, estimated from the drawing. */
export type LayoutFit = {
  layout: Layout;
  seats: number;
  facingFront: number;
  closeToYou: number;
  /** Shrunk below real desk size to fit the room. */
  shrunk: boolean;
  /** Points from the comparing-layouts formula; higher fits the class better. */
  score: number;
};

export type LayoutComparison = { now: LayoutFit | null; better: { fit: LayoutFit; better: string[]; worse: string[] }[] };

// The comparing-layouts formula: what each thing is worth, in points.
const SCORE = {
  // Fewer seats than students: a flat cost, then more for each missing seat.
  seatsShort: 40,
  perMissingSeat: 8,
  // Front-facing seats for the students who need one, and front-facing seats overall.
  frontForNeeds: 30,
  frontShare: 1, // In an office, facing the front matters little unless someone needs it.
  // Close seats for the 1s, and close seats overall.
  closeForOnes: 20,
  closeShare: 4,
  // Shrinking: a lot below SMALL_SIZE, a little below full size.
  shrunkBelowSmall: 30,
  shrunkBelowFull: 6,
  // Overlapping desks, and empty seats (a small cost, so the snugger fit wins a tie).
  perOverlap: 4,
  perExtraSeat: 0.3,
};
// Desks below this share of real size cost a lot more.
const SMALL_SIZE = 0.8;
// A layout is suggested only if it beats the current one by more than this.
const CLEARLY_BETTER = 1.5;
const MAX_SUGGESTIONS = 3;

function fitOf(doc: ClassroomDocument, room: DocRoom, layout: Layout): LayoutFit {
  const engine = engineRoom(room);
  const seats = engine.seats.length;
  const facingFront = engine.facesFront.filter(Boolean).length;
  const closeToYou = engine.seats.filter((seat) => seat.zone === 'green').length;
  const size = room.layout?.size ?? 1;
  const students = doc.students.length;
  // Only students who must face the front count; a nice-to-have doesn't decide the layout.
  const needFront = doc.students.filter((student) => student.needs['face-front'] === 'must').length;
  const ones = doc.students.filter((student) => student.level === 1).length;
  const share = (have: number, want: number) => (want === 0 ? 1 : Math.min(1, have / want));
  const missing = Math.max(0, students - seats);
  const score =
    (missing > 0 ? -SCORE.seatsShort - SCORE.perMissingSeat * missing : 0) +
    SCORE.frontForNeeds * share(facingFront, needFront) +
    SCORE.frontShare * (seats > 0 ? facingFront / seats : 0) +
    SCORE.closeForOnes * share(closeToYou, ones) +
    SCORE.closeShare * (seats > 0 ? closeToYou / seats : 0) -
    SCORE.shrunkBelowSmall * Math.max(0, SMALL_SIZE - size) -
    SCORE.shrunkBelowFull * Math.max(0, 1 - size) -
    SCORE.perOverlap * piecesOverlapping(room).length -
    SCORE.perExtraSeat * Math.max(0, seats - students);
  return { layout, seats, facingFront, closeToYou, shrunk: size < 1, score };
}

function differences(now: LayoutFit | null, fit: LayoutFit, students: number): { better: string[]; worse: string[] } {
  const better: string[] = [];
  const worse: string[] = [];
  if (fit.seats < students) worse.push(`${count(students - fit.seats, 'seat')} short`);
  // Without the layout there now (e.g. it left the library), there's nothing to compare with.
  if (!now) return { better, worse };
  const front = fit.facingFront - (now?.facingFront ?? 0);
  const close = fit.closeToYou - (now?.closeToYou ?? 0);
  if (front > 0) better.push(`${count(front, 'more seat')} face the front`);
  if (front < 0) worse.push(`${count(-front, 'fewer seat')} face the front`);
  if (close > 0) better.push(`${count(close, 'more seat')} close to you`);
  if (close < 0) worse.push(`${count(-close, 'fewer seat')} close to you`);
  if (now?.shrunk && !fit.shrunk) better.push('bigger desks on screen');
  if (!now?.shrunk && fit.shrunk) worse.push('smaller desks on screen');
  return { better, worse };
}

/**
 * Every desk and table layout placed in this room the way "Try it" would,
 * scored with the comparing-layouts formula. Only ones that beat the current
 * layout clearly come back, best first, with what's better and what's worse.
 */
export function compareLayouts(doc: ClassroomDocument, layouts: Layout[]): LayoutComparison {
  const { now, fits } = placedFits(doc, layouts);
  const better = fits
    .filter((fit) => fit.score > (now?.score ?? -Infinity) + CLEARLY_BETTER)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((fit) => ({ fit, ...differences(now, fit, doc.students.length) }));
  return { now, better };
}

// The layout there now, and every other desk and table layout placed the way "Try it" would, scored.
function placedFits(doc: ClassroomDocument, layouts: Layout[]): { now: LayoutFit | null; fits: LayoutFit[] } {
  const current = layouts.find((layout) => layout.id === doc.room.layout?.id) ?? null;
  const now = current ? fitOf(doc, doc.room, current) : null;
  const fits = layouts
    .filter((layout) => layout.category !== 'carpets' && layout.id !== current?.id)
    .map((layout) => fitOf(doc, chooseLayout(doc.room, layout, current), layout));
  return { now, fits };
}

/** Puts a suggested layout in the room, keeping the teacher's changes to the old one for later. The new seats start empty, and a locked room stays locked. */
export function switchLayout(doc: ClassroomDocument, layout: Layout, current: Layout | null): ClassroomDocument {
  return { ...doc, room: { ...chooseLayout(doc.room, layout, current), locked: doc.room.locked }, seating: { ...doc.seating, assignment: {}, lockedSeats: [] } };
}

/**
 * Layouts where every seat faces the front and the whole class fits, best
 * by the comparing-layouts points first. For a class with students who need
 * to see the board.
 */
export function frontFacingLayouts(doc: ClassroomDocument, layouts: Layout[]): LayoutComparison {
  const { now, fits } = placedFits(doc, layouts);
  const better = fits
    .filter((fit) => fit.seats >= doc.students.length && fit.seats > 0 && fit.facingFront === fit.seats)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((fit) => ({ fit, ...differences(now, fit, doc.students.length) }));
  return { now, better };
}
