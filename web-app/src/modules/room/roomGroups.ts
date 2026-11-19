import type { DocPiece, DocRoom } from '@modules/classroom/document';
import { boxOfPoints, cutBox, pieceBox, pieceOutline, pointOnFloor, touchGroups, type Box } from '@modules/room/roomGeometry';
import { UNITS_PER_FOOT } from '@modules/room/units';

// Where-I-teach spots stay this far inside the walls.
const SPOT_WALL_GAP = UNITS_PER_FOOT;

// Ids of pieces and seats that came from a layout ("L-") or were added to it ("A-").
export const LAYOUT_PREFIX = 'L-';
export const ADDED_PREFIX = 'A-';
// The library measures in desk lengths; the room in drawing units.
import { UNITS_PER_DESK } from '@modules/seating/engine/settings';
import { MAX_PIECES, MAX_SEATS } from '@shared/serverLimits';

export { UNITS_PER_DESK };
export { MAX_PIECES, MAX_SEATS };

export function isLayoutPiece(id: string): boolean {
  return id.startsWith(LAYOUT_PREFIX) || id.startsWith(ADDED_PREFIX);
}

/** A desk's width in the room at the layout's size. */
export function deskUnit(room: Pick<DocRoom, 'layout'>): number {
  return UNITS_PER_DESK * (room.layout?.size ?? 1);
}

/**
 * The next free number for ids like "A-d7" or "A-c3-…": one more than the
 * highest in use, so removing one never makes a new id repeat an old one.
 */
export function nextNumber(room: DocRoom, letter: 'd' | 'c'): number {
  const pattern = new RegExp(`^${ADDED_PREFIX}${letter}(\\d+)`);
  const used = [...room.pieces.map((piece) => piece.id), ...room.seats.map((seat) => seat.id)]
    .map((id) => pattern.exec(id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

/** The group a piece belongs to: set when placed; older rooms fall back to pieces that touch. */
export function pieceGroups(room: DocRoom): Map<string, string[]> {
  const pieces = room.pieces.filter((piece) => isLayoutPiece(piece.id));
  const touching = touchGroups(pieces.map(pieceBox), deskUnit(room) * 0.05);
  const keyOf = (piece: DocPiece, index: number) => piece.group ?? `touch-${touching[index]}`;
  const byKey = new Map<string, string[]>();
  pieces.forEach((piece, index) => byKey.set(keyOf(piece, index), [...(byKey.get(keyOf(piece, index)) ?? []), piece.id]));
  const groups = new Map<string, string[]>();
  for (const members of byKey.values()) for (const id of members) groups.set(id, members);
  return groups;
}

export function boundsOf(pieces: DocPiece[]): Box | null {
  if (pieces.length === 0) return null;
  return boxOfPoints(pieces.flatMap(pieceOutline));
}

/** Moves pieces (by id) and their seats by dx, dy. */
export function shiftPieces(room: DocRoom, ids: Set<string>, dx: number, dy: number): DocRoom {
  if (!dx && !dy) return room;
  return {
    ...room,
    pieces: room.pieces.map((piece) => (ids.has(piece.id) ? { ...piece, x: piece.x + dx, y: piece.y + dy } : piece)),
    seats: room.seats.map((seat) => (ids.has(seat.furnitureId) ? { ...seat, x: seat.x + dx, y: seat.y + dy } : seat)),
  };
}

/** Slides a group out of an L's missing corner the shortest way that keeps it inside the walls. */
function outOfCut(room: DocRoom, block: string[]): DocRoom {
  const cut = cutBox(room);
  const box = boundsOf(room.pieces.filter((piece) => block.includes(piece.id)));
  if (!cut || !box || box.right <= cut.left || box.left >= cut.right || box.bottom <= cut.top || box.top >= cut.bottom) return room;
  const moves: [number, number][] = [
    [cut.left - box.right, 0],
    [cut.right - box.left, 0],
    [0, cut.top - box.bottom],
    [0, cut.bottom - box.top],
  ];
  const fits = ([dx, dy]: [number, number]) =>
    box.left + dx >= 0 && box.right + dx <= room.width && box.top + dy >= 0 && box.bottom + dy <= room.depth;
  const best = moves.filter(fits).sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0];
  return best ? shiftPieces(room, new Set(block), best[0], best[1]) : room;
}

/**
 * Pulls every table (with its chairs) and every piece of furniture back
 * inside the outer walls, each as one block, e.g. after the room shrinks.
 */
export function keepGroupsInside(room: DocRoom): DocRoom {
  const groups = pieceGroups(room);
  const blocks: string[][] = [];
  const seen = new Set<string>();
  for (const piece of room.pieces) {
    if (seen.has(piece.id)) continue;
    // Furniture joined together (My desk and its chair) moves as one block too.
    const block = groups.get(piece.id) ?? (piece.group ? room.pieces.filter((other) => other.group === piece.group).map((other) => other.id) : [piece.id]);
    block.forEach((id) => seen.add(id));
    blocks.push(block);
  }
  let next = room;
  for (const block of blocks) {
    const box = boundsOf(next.pieces.filter((piece) => block.includes(piece.id)));
    if (!box) continue;
    const dx = box.left < 0 ? -box.left : box.right > next.width ? next.width - box.right : 0;
    const dy = box.top < 0 ? -box.top : box.bottom > next.depth ? next.depth - box.bottom : 0;
    next = shiftPieces(next, new Set(block), dx, dy);
    next = outOfCut(next, block);
  }
  return { ...next, spots: next.spots.map((spot) => ({ ...spot, ...pointOnFloor(next, spot.x, spot.y, SPOT_WALL_GAP) })) };
}
