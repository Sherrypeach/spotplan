import type { DocRoom } from '@modules/classroom/document';
import { boxesTouch, floorOutline, outlineOnFloor, pieceBox, pieceOutline, shrinkOutline, TOUCHING, type Box } from '@modules/room/roomGeometry';
import {
  ADDED_PREFIX,
  boundsOf,
  deskUnit,
  keepGroupsInside,
  MAX_PIECES,
  MAX_SEATS,
  nextNumber,
  pieceGroups,
  shiftPieces,
} from '@modules/room/roomGroups';

export { pieceGroups } from '@modules/room/roomGroups';

/** What a click on a piece does: picks up its whole table, or puts it down if it's already picked up. */
export function selectionAfterClick(room: DocRoom, current: string[], clicked: string): string[] {
  if (current.includes(clicked)) return [];
  return pieceGroups(room).get(clicked) ?? [clicked];
}

/**
 * Every desk and table a box drawn over the room touches, each with the rest
 * of its table, so a box catching one desk of a pod takes the whole pod.
 */
export function piecesInBox(room: DocRoom, box: Box): string[] {
  const groups = pieceGroups(room);
  const touched = room.pieces.filter((piece) => groups.has(piece.id) && boxesTouch(pieceBox(piece), box, 0));
  return [...new Set(touched.flatMap((piece) => groups.get(piece.id) ?? [piece.id]))];
}

export function selectionBounds(room: DocRoom, ids: string[]) {
  return boundsOf(room.pieces.filter((piece) => ids.includes(piece.id)));
}

/** The middle of the selection, which it turns around. */
export function selectionCenter(room: DocRoom, ids: string[]): { x: number; y: number } | null {
  const box = selectionBounds(room, ids);
  return box ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : null;
}

function onFloor(room: DocRoom, ids: string[]): boolean {
  const floor = floorOutline(room);
  return room.pieces.filter((piece) => ids.includes(piece.id)).every((piece) => outlineOnFloor(shrinkOutline(pieceOutline(piece), TOUCHING), floor));
}

/**
 * How far the selection may really move: never past the outer walls, and in
 * an L never into the missing corner (it stops where it still fits).
 */
export function clampMove(room: DocRoom, ids: string[], dx: number, dy: number): { dx: number; dy: number } {
  const box = selectionBounds(room, ids);
  if (!box) return { dx: 0, dy: 0 };
  const rx = Math.min(Math.max(dx, -box.left), room.width - box.right);
  const ry = Math.min(Math.max(dy, -box.top), room.depth - box.bottom);
  if (room.shape !== 'l-shape') return { dx: rx, dy: ry };
  const set = new Set(ids);
  if (!onFloor(room, ids) || onFloor(shiftPieces(room, set, rx, ry), ids)) return { dx: rx, dy: ry };
  // The farthest point along the way that still fits.
  let good = 0;
  let bad = 1;
  for (let step = 0; step < 12; step++) {
    const middle = (good + bad) / 2;
    if (onFloor(shiftPieces(room, set, rx * middle, ry * middle), ids)) good = middle;
    else bad = middle;
  }
  return { dx: rx * good, dy: ry * good };
}

/** Moves the selected pieces and their chairs, kept inside the walls. */
export function moveSelection(room: DocRoom, ids: string[], dx: number, dy: number): DocRoom {
  const move = clampMove(room, ids, dx, dy);
  return shiftPieces(room, new Set(ids), move.dx, move.dy);
}

function angle(value: number): number {
  return Math.round((((value % 360) + 360) % 360) * 10) / 10;
}

/**
 * Turns the selection clockwise by `degrees` (any angle) around its middle,
 * chairs and all. Returns the room unchanged when it wouldn't fit.
 */
export function turnSelection(room: DocRoom, ids: string[], degrees = 90): DocRoom {
  const center = selectionCenter(room, ids);
  if (!center) return room;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Clockwise on screen, where y points down.
  const turn = <T extends { x: number; y: number }>(item: T): T => ({
    ...item,
    x: center.x + (item.x - center.x) * cos - (item.y - center.y) * sin,
    y: center.y + (item.x - center.x) * sin + (item.y - center.y) * cos,
  });
  const turned: DocRoom = {
    ...room,
    pieces: room.pieces.map((piece) => (ids.includes(piece.id) ? { ...turn(piece), rotation: angle(piece.rotation + degrees) } : piece)),
    seats: room.seats.map((seat) => (ids.includes(seat.furnitureId) ? { ...turn(seat), facing: angle(seat.facing + degrees) } : seat)),
  };
  const box = selectionBounds(turned, ids);
  if (!box || box.right - box.left > room.width || box.bottom - box.top > room.depth) return room;
  // Turning near a wall can push it out: slide it back in.
  const dx = box.left < 0 ? -box.left : box.right > room.width ? room.width - box.right : 0;
  const dy = box.top < 0 ? -box.top : box.bottom > room.depth ? room.depth - box.bottom : 0;
  const inside = shiftPieces(turned, new Set(ids), dx, dy);
  // In an L, a turn that would reach into the missing corner doesn't happen.
  return onFloor(inside, ids) || !onFloor(room, ids) ? inside : room;
}

/**
 * Breaks a table into its pieces: each becomes its own table, nudged a
 * little away from the middle so they no longer touch.
 */
export function splitSelection(room: DocRoom, ids: string[]): DocRoom {
  const center = selectionCenter(room, ids);
  if (!center || ids.length < 2) return room;
  const gap = deskUnit(room) * 0.2;
  let next: DocRoom = {
    ...room,
    // A piece's own id is a group name no other piece has.
    pieces: room.pieces.map((piece) => (ids.includes(piece.id) ? { ...piece, group: piece.id } : piece)),
  };
  // Every piece moves out from the middle in proportion to how far it is, so
  // pieces in a row all end up apart, not just the two in the middle.
  const pieces = room.pieces.filter((candidate) => ids.includes(candidate.id));
  const nearest = Math.min(...pieces.map((piece) => Math.hypot(piece.x - center.x, piece.y - center.y)).filter((d) => d > 0));
  const spread = Number.isFinite(nearest) ? gap / nearest : 0;
  for (const piece of pieces) {
    next = shiftPieces(next, new Set([piece.id]), (piece.x - center.x) * spread, (piece.y - center.y) * spread);
  }
  return keepGroupsInside(next);
}

/** Takes the selected pieces and their chairs out of the room. */
export function removeSelection(room: DocRoom, ids: string[]): DocRoom {
  const seatIds = new Set(room.seats.filter((seat) => ids.includes(seat.furnitureId)).map((seat) => seat.id));
  const labels = Object.fromEntries(Object.entries(room.labels).filter(([seat]) => !seatIds.has(seat)));
  return {
    ...room,
    pieces: room.pieces.filter((piece) => !ids.includes(piece.id)),
    seats: room.seats.filter((seat) => !seatIds.has(seat.id)),
    labels,
    handSetLabels: room.handSetLabels.filter((id) => !seatIds.has(id)),
  };
}

// A copy's id is built from the original's, never from another copy's, so ids stay short.
function originalId(id: string): string {
  return id.replace(/^(A-c\d+-)+/, '');
}

/**
 * Copies the selection into the nearest open floor beside it. Returns the
 * room and the copy's piece ids (empty when there's no room for it, or the
 * class would go over the most seats a room can have).
 */
export function copySelection(room: DocRoom, ids: string[]): { room: DocRoom; copied: string[] } {
  const box = selectionBounds(room, ids);
  const originals = room.pieces.filter((piece) => ids.includes(piece.id));
  const chairs = room.seats.filter((seat) => ids.includes(seat.furnitureId));
  if (!box || room.pieces.length + originals.length > MAX_PIECES || room.seats.length + chairs.length > MAX_SEATS) {
    return { room, copied: [] };
  }
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const gap = deskUnit(room) * 0.4;
  const floor = floorOutline(room);
  const others = room.pieces.map(pieceBox);
  const tries: [number, number][] = [];
  for (let ring = 1; ring <= 4; ring++) {
    tries.push([ring * (width + gap), 0], [-ring * (width + gap), 0], [0, ring * (height + gap)], [0, -ring * (height + gap)]);
    tries.push([ring * (width + gap), ring * (height + gap)], [-ring * (width + gap), ring * (height + gap)]);
  }
  const number = nextNumber(room, 'c');
  const newId = (id: string) => `${ADDED_PREFIX}c${number}-${originalId(id)}`;
  for (const [dx, dy] of tries) {
    const pieces = originals.map((piece) => ({ ...piece, id: newId(piece.id), group: `c${number}`, x: piece.x + dx, y: piece.y + dy }));
    const fits =
      pieces.every((piece) => outlineOnFloor(pieceOutline(piece), floor)) &&
      !pieces.some((piece) => others.some((other) => boxesTouch(pieceBox(piece), other, gap / 2)));
    if (!fits) continue;
    const seats = chairs.map((seat) => ({ ...seat, id: newId(seat.id), furnitureId: newId(seat.furnitureId), x: seat.x + dx, y: seat.y + dy }));
    return { room: { ...room, pieces: [...room.pieces, ...pieces], seats: [...room.seats, ...seats] }, copied: pieces.map((piece) => piece.id) };
  }
  return { room, copied: [] };
}
