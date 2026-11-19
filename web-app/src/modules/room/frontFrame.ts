import type { DocPiece, DocRoom, DocSeat, DocSpot, RoomCorner, WallSide } from '@modules/classroom/document';
import { frontWall } from '@modules/room/roomGeometry';
import { UNITS_PER_FOOT } from '@modules/room/units';

/**
 * The board can be on any wall, but layouts, the seating engine and "faces
 * the front" all think of the front as the top. These turn a room by quarter
 * turns so its board wall is at the top, and back again: the teacher's room
 * never moves, only the pictures the code works on.
 */

/** For each wall, the direction straight into the room from it. */
export const INWARD: Record<WallSide, { x: number; y: number }> = { top: { x: 0, y: 1 }, bottom: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } };

/** How far a point is from a wall of the room. */
export function distanceToWall(room: Pick<DocRoom, 'width' | 'depth'>, wall: WallSide, point: { x: number; y: number }): number {
  return { top: point.y, bottom: room.depth - point.y, left: point.x, right: room.width - point.x }[wall];
}

/** Clockwise quarter turns from the top wall to each wall. */
const QUARTERS: Record<WallSide, number> = { top: 0, right: 1, bottom: 2, left: 3 };
const SIDES: WallSide[] = ['top', 'right', 'bottom', 'left'];
const CORNERS: RoomCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

export function frontOf(room: Pick<DocRoom, 'front'>): WallSide {
  return room.front ?? 'top';
}

/** Clockwise quarter turns that take wall `from` to wall `to`. */
export function quartersBetween(from: WallSide, to: WallSide): number {
  return (QUARTERS[to] - QUARTERS[from] + 4) % 4;
}

type Turnable = Pick<DocRoom, 'width' | 'depth' | 'pieces' | 'seats' | 'spots'> & Partial<DocRoom>;

// One clockwise quarter turn: the left wall becomes the top, the top the right.
function turnPoint(room: { depth: number }, x: number, y: number): { x: number; y: number } {
  return { x: room.depth - y, y: x };
}

function turnOnce<T extends Turnable>(room: T): T {
  const point = <P extends { x: number; y: number }>(p: P): P => ({ ...p, ...turnPoint(room, p.x, p.y) });
  const piece = (p: DocPiece): DocPiece => ({
    ...point(p),
    rotation: (p.rotation + 90) % 360,
    ...(p.wall ? { wall: SIDES[(QUARTERS[p.wall] + 1) % 4] } : {}),
  });
  const seat = (s: DocSeat): DocSeat => ({ ...point(s), facing: (s.facing + 90) % 360 });
  const turned: T = {
    ...room,
    width: room.depth,
    depth: room.width,
    pieces: room.pieces.map(piece),
    seats: room.seats.map(seat),
    spots: room.spots.map((s: DocSpot) => point(s)),
  };
  if (room.front) turned.front = SIDES[(QUARTERS[room.front] + 1) % 4];
  if (room.cutCorner) {
    turned.cutCorner = CORNERS[(CORNERS.indexOf(room.cutCorner) + 1) % 4];
    turned.cutWidth = room.cutDepth;
    turned.cutDepth = room.cutWidth;
  }
  if (room.savedLayouts) {
    turned.savedLayouts = Object.fromEntries(
      Object.entries(room.savedLayouts).map(([id, saved]) => [id, { ...saved, pieces: saved.pieces.map(piece), seats: saved.seats.map(seat) }]),
    );
  }
  return turned;
}

/** The room turned by clockwise quarter turns. */
function turnRoom<T extends Turnable>(room: T, quarters: number): T {
  let turned = room;
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) turned = turnOnce(turned);
  return turned;
}

/** The room as the code thinks of it: its board wall at the top. */
export function toFrontUp<T extends Turnable>(room: T): T {
  return turnRoom(room, quartersBetween(frontOf(room), 'top'));
}

/** A room worked on front-up, turned back to how the teacher drew it. */
export function fromFrontUp<T extends Turnable>(room: T, front: WallSide): T {
  return turnRoom(room, quartersBetween('top', front));
}

/** A point in the front-up room, back where it is in the room as drawn. */
export function pointFromFrontUp(room: DocRoom, point: { x: number; y: number }): { x: number; y: number } {
  const quarters = quartersBetween('top', frontOf(room));
  // The front-up room is the drawn one turned, so its depth is the drawn width after an odd number of turns.
  let depth = quarters % 2 === 1 ? room.width : room.depth;
  let width = quarters % 2 === 1 ? room.depth : room.width;
  let at = point;
  for (let i = 0; i < quarters; i++) {
    at = { x: depth - at.y, y: at.x };
    [width, depth] = [depth, width];
  }
  return at;
}

// The board is half its wall long, at most this many feet.
const BOARD_MAX_FEET = 12;

/** How long the board is drawn on its wall. */
export function boardLength(room: DocRoom): number {
  return Math.min(boardPlace(room).length * 0.5, UNITS_PER_FOOT * BOARD_MAX_FEET);
}

/** Where the board hangs: the middle of the front wall, how long that wall is, and its angle (0 across, 90 up and down). */
export function boardPlace(room: DocRoom): { x: number; y: number; length: number; angle: number } {
  const [from, to] = frontWall(toFrontUp(room));
  const side = frontOf(room);
  return { ...pointFromFrontUp(room, { x: (from + to) / 2, y: 0 }), length: to - from, angle: side === 'left' || side === 'right' ? 90 : 0 };
}

