import type { DocPiece, DocRoom, DocSeat } from '@modules/classroom/document';
import type { Layout } from '@modules/layouts/types';
import {
  boxesTouch,
  boxOfPoints,
  floorOutline,
  onRug,
  outlineOnFloor,
  outlinesOverlap,
  pieceBox,
  pieceOutline,
  shrinkOutline,
  TOUCHING,
  touchGroups,
  type Box,
} from '@modules/room/roomGeometry';
import {
  ADDED_PREFIX,
  boundsOf,
  deskUnit,
  isLayoutPiece,
  keepGroupsInside,
  LAYOUT_PREFIX,
  MAX_PIECES,
  MAX_SEATS,
  nextNumber,
  UNITS_PER_DESK,
} from '@modules/room/roomGroups';
import { frontOf, fromFrontUp, toFrontUp } from '@modules/room/frontFrame';
import { FURNITURE_CHAIR_SHARE, furnitureOf } from '@modules/room/furniture';
import { UNITS_PER_FOOT } from '@modules/room/units';
import { furnitureOutline } from '@modules/seating/engine/geometry';
import { MAX_LAYOUT_SIZE, MAX_SAVED_LAYOUTS, MIN_LAYOUT_SIZE } from '@shared/serverLimits';

export { isLayoutPiece, UNITS_PER_DESK } from '@modules/room/roomGroups';

// Layout size range: 45% to 115% of real desk size.
export { MIN_LAYOUT_SIZE, MAX_LAYOUT_SIZE };
// The size slider moves in steps this big.
export const LAYOUT_SIZE_STEP = 0.05;
// Below this size, names on the chart get hard to read.
export const SMALLEST_READABLE_SIZE = 0.62;
// Space left between the layout and the walls.
const WALL_MARGIN = UNITS_PER_FOOT;
// Moves smaller than this (in room units) don't count as changes.
const SAME_PLACE = 0.5;

type Rect = { x: number; y: number; width: number; height: number };

/** The biggest open rectangle of floor: the whole room, or the bigger arm of an L. */
function openFloor(room: DocRoom): Rect {
  const inner = (rect: Rect): Rect => ({
    x: rect.x + WALL_MARGIN,
    y: rect.y + WALL_MARGIN,
    width: Math.max(0, rect.width - WALL_MARGIN * 2),
    height: Math.max(0, rect.height - WALL_MARGIN * 2),
  });
  if (room.shape !== 'l-shape' || !room.cutCorner || !room.cutWidth || !room.cutDepth) {
    return inner({ x: 0, y: 0, width: room.width, height: room.depth });
  }
  const { width, depth, cutWidth, cutDepth, cutCorner } = room;
  const top = cutCorner.startsWith('top');
  const left = cutCorner.endsWith('left');
  const wide: Rect = { x: 0, y: top ? cutDepth : 0, width, height: depth - cutDepth };
  const deep: Rect = { x: left ? cutWidth : 0, y: 0, width: width - cutWidth, height: depth };
  return inner(wide.width * wide.height >= deep.width * deep.height ? wide : deep);
}

/** The size that fits the layout's drawing inside the open floor, kept to that range, at most real size. */
export function fittedSize(room: DocRoom, layout: Layout): number {
  return fittedSizeFrontUp(toFrontUp(room), layout);
}

function fittedSizeFrontUp(room: DocRoom, layout: Layout): number {
  const floor = openFloor(room);
  const fit = Math.min(floor.width / (layout.stage.width * UNITS_PER_DESK), floor.height / (layout.stage.height * UNITS_PER_DESK));
  // On a step of the size slider, so the slider can come back to it.
  const stepped = Math.floor(fit / LAYOUT_SIZE_STEP + 1e-9) * LAYOUT_SIZE_STEP;
  return Math.min(1, Math.max(MIN_LAYOUT_SIZE, Math.round(stepped * 100) / 100));
}

/**
 * The layout's desks and chairs in the room at `size`: centered side to side
 * on the open floor and lined up with its front. The teacher's own furniture
 * stays; the old layout and its seat labels go.
 */
export function placeLayout(room: DocRoom, layout: Layout, size: number): DocRoom {
  // Layouts are drawn front-up: placed in the room turned that way, then turned back to face the board.
  return fromFrontUp(placeLayoutFrontUp(toFrontUp(room), layout, size), frontOf(room));
}

function placeLayoutFrontUp(room: DocRoom, layout: Layout, size: number): DocRoom {
  const floor = openFloor(room);
  const unit = UNITS_PER_DESK * size;
  const offsetX = floor.x + (floor.width - layout.stage.width * unit) / 2;
  const offsetY = floor.y;
  const at = (value: number, offset: number) => Math.round((offset + value * unit) * 10) / 10;
  // Desks that touch in the library's drawing are one table or pod, for good.
  const groups = touchGroups(
    layout.furniture.map((piece) => boxOfPoints(furnitureOutline(piece))),
    0.05,
  );

  const pieces: DocPiece[] = layout.furniture.map((piece, index) => {
    const placed: DocPiece = {
      id: LAYOUT_PREFIX + piece.id,
      group: `g${groups[index]}`,
      kind: piece.kind,
      x: at(piece.x, offsetX),
      y: at(piece.y, offsetY),
      w: Math.round(piece.w * unit * 10) / 10,
      h: Math.round(piece.h * unit * 10) / 10,
      rotation: piece.rotation,
      flipH: piece.flipH,
    };
    if ('inset' in piece) placed.inset = piece.inset;
    if ('shape' in piece) placed.shape = piece.shape;
    if ('sweep' in piece) placed.sweep = piece.sweep;
    if ('label' in piece && piece.label) placed.label = piece.label;
    return placed;
  });
  const seats: DocSeat[] = layout.seats.map((seat) => ({
    id: LAYOUT_PREFIX + seat.id,
    furnitureId: LAYOUT_PREFIX + seat.furnitureId,
    x: at(seat.x, offsetX),
    y: at(seat.y, offsetY),
    facing: seat.facing,
  }));

  return {
    ...room,
    pieces: [...room.pieces.filter((piece) => !isLayoutPiece(piece.id)), ...pieces],
    seats,
    labels: {},
    handSetLabels: [],
    layout: { id: layout.id, size, fitted: size },
    // A new layout unlocks the room (it's still being set up).
    locked: false,
  };
}

/**
 * Makes the desks smaller or bigger where they are: every table and chair
 * moves in or out from the middle of the layout, so moves and turns are kept.
 */
export function scaleLayout(room: DocRoom, size: number): DocRoom {
  if (!room.layout) return room;
  const next = Math.min(MAX_LAYOUT_SIZE, Math.max(MIN_LAYOUT_SIZE, size));
  const factor = next / room.layout.size;
  const box = boundsOf(room.pieces.filter((piece) => isLayoutPiece(piece.id)));
  if (!box || factor === 1) return { ...room, layout: { ...room.layout, size: next } };
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const scaled: DocRoom = {
    ...room,
    pieces: room.pieces.map((piece) =>
      isLayoutPiece(piece.id)
        ? { ...piece, x: cx + (piece.x - cx) * factor, y: cy + (piece.y - cy) * factor, w: piece.w * factor, h: piece.h * factor }
        : piece,
    ),
    seats: room.seats.map((seat) => ({ ...seat, x: cx + (seat.x - cx) * factor, y: cy + (seat.y - cy) * factor })),
    layout: { ...room.layout, size: next },
  };
  return keepGroupsInside(scaled);
}

/** Layout pieces that poke through a wall (or into the missing corner of an L). Rugs are left out. */
export function piecesOutsideWalls(room: DocRoom): string[] {
  const floor = floorOutline(room);
  return room.pieces
    .filter((piece) => isLayoutPiece(piece.id) && piece.kind !== 'carpet')
    .filter((piece) => !outlineOnFloor(shrinkOutline(pieceOutline(piece), TOUCHING), floor))
    .map((piece) => piece.id);
}

/** Layout pieces lying on top of a piece from another table or pod. */
export function piecesOverlapping(room: DocRoom): string[] {
  const pieces = room.pieces.filter((piece) => isLayoutPiece(piece.id) && piece.kind !== 'carpet');
  const outlines = pieces.map(pieceOutline);
  const tolerance = deskUnit(room) * 0.05;
  const hit = new Set<string>();
  // Desks can't stand on the teacher's furniture (a rug is fine to sit around, not on).
  // The chairs drawn around a desk or table count too.
  const furniture = furnitureOf(room)
    .filter((piece) => piece.kind !== 'rug')
    .map((piece) => {
      // A small-group table's chairs are drawn with it; the teacher's chair is its own piece.
      const reach = piece.kind === 'small-group-table' ? Math.min(piece.w, piece.h) * FURNITURE_CHAIR_SHARE : 0;
      return pieceOutline({ ...piece, w: piece.w + reach * 2, h: piece.h + reach * 2 });
    });
  for (const [index, piece] of pieces.entries()) {
    if (furniture.some((outline) => outlinesOverlap(outlines[index], outline, tolerance))) hit.add(piece.id);
  }
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const sameTable = pieces[i].group !== undefined && pieces[i].group === pieces[j].group;
      if (sameTable || !outlinesOverlap(outlines[i], outlines[j], tolerance)) continue;
      hit.add(pieces[i].id);
      hit.add(pieces[j].id);
    }
  }
  return [...hit];
}

/** The rug the class sits on, when the layout is a rug. */
export function rugOf(room: DocRoom): DocPiece | null {
  return room.pieces.find((piece) => isLayoutPiece(piece.id) && piece.kind === 'carpet') ?? null;
}

function distanceToBox(x: number, y: number, box: Box): number {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy);
}

/** Single desks with one chair each, behind and beside the layout first, never in its aisles. */
function addDesks(room: DocRoom, count: number): { room: DocRoom; added: number } {
  const unit = deskUnit(room);
  const width = unit;
  const height = 0.685 * unit;
  const floor = floorOutline(room);
  const boxes = room.pieces.map(pieceBox);
  const layoutBox = boundsOf(room.pieces.filter((piece) => isLayoutPiece(piece.id)));

  const step = unit / 2;
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = height / 2 + WALL_MARGIN; y <= room.depth - height / 2 - WALL_MARGIN; y += step) {
    for (let x = width / 2 + WALL_MARGIN; x <= room.width - width / 2 - WALL_MARGIN; x += step) {
      // Outside the layout is better than in its aisles; behind it is better than in front.
      const near = layoutBox ? distanceToBox(x, y, layoutBox) : Math.hypot(x - room.width / 2, y - room.depth / 2);
      const inside = layoutBox !== null && near === 0;
      const inFront = layoutBox !== null && y < layoutBox.top;
      candidates.push({ x, y, score: near + (inside ? 1e6 : 0) + (inFront ? 1e3 : 0) });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  const pieces = [...room.pieces];
  const seats = [...room.seats];
  let added = 0;
  let number = nextNumber(room, 'd');
  for (const spot of candidates) {
    if (added === count || seats.length >= MAX_SEATS || pieces.length >= MAX_PIECES) break;
    const desk: DocPiece = {
      id: `${ADDED_PREFIX}d${number}`,
      group: `a${number}`,
      kind: 'desk',
      x: spot.x,
      y: spot.y,
      w: width,
      h: height,
      rotation: 180,
      flipH: false,
    };
    const box = pieceBox(desk);
    const fits = outlineOnFloor(pieceOutline(desk), floor) && !boxes.some((other) => boxesTouch(box, other, unit * 0.25));
    if (!fits) continue;
    pieces.push(desk);
    boxes.push(box);
    // The chair sits behind the desk, facing the front, as in the Traditional layout.
    seats.push({ id: `${ADDED_PREFIX}d${number}s`, furnitureId: desk.id, x: spot.x, y: spot.y + 0.417 * unit, facing: 0 });
    added++;
    number++;
  }
  return { room: { ...room, pieces, seats }, added };
}

/** Spots on the rug, where they're farthest from the others. */
function addSpots(room: DocRoom, rug: DocPiece, count: number): { room: DocRoom; added: number } {
  const spacing = deskUnit(room) * 0.55;
  const step = spacing / 2;
  const half = Math.max(rug.w, rug.h) / 2;
  const candidates: { x: number; y: number }[] = [];
  for (let y = rug.y - half; y <= rug.y + half; y += step) {
    for (let x = rug.x - half; x <= rug.x + half; x += step) {
      if (onRug({ x, y }, rug, spacing / 3)) candidates.push({ x, y });
    }
  }
  const seats = [...room.seats];
  let added = 0;
  let number = nextNumber(room, 'd');
  while (added < count && seats.length < MAX_SEATS) {
    const onThisRug = seats.filter((seat) => seat.furnitureId === rug.id);
    const roomiest = candidates
      .map((spot) => ({ spot, gap: Math.min(Infinity, ...onThisRug.map((seat) => Math.hypot(seat.x - spot.x, seat.y - spot.y))) }))
      .sort((a, b) => b.gap - a.gap)[0];
    if (!roomiest || roomiest.gap < spacing * 0.6) break;
    seats.push({ id: `${ADDED_PREFIX}d${number}s`, furnitureId: rug.id, x: roomiest.spot.x, y: roomiest.spot.y, facing: 0 });
    added++;
    number++;
  }
  return { room: { ...room, seats }, added };
}

/** Adds seats for the class: spots on the rug, or single desks in open floor. */
export function addSeats(room: DocRoom, count: number): { room: DocRoom; added: number } {
  // "Behind the layout" means away from the board: worked out front-up, then turned back.
  const up = toFrontUp(room);
  const rug = rugOf(up);
  const result = rug ? addSpots(up, rug, count) : addDesks(up, count);
  return { room: fromFrontUp(result.room, frontOf(room)), added: result.added };
}

/** Moves one spot on the rug, stopping at the rug's edge. */
export function moveSpot(room: DocRoom, seatId: string, dx: number, dy: number): DocRoom {
  const seat = room.seats.find((s) => s.id === seatId);
  const rug = seat ? room.pieces.find((piece) => piece.id === seat.furnitureId) : undefined;
  if (!seat || !rug) return room;
  // The farthest point along the move that's still on the rug.
  let t = 1;
  for (let tries = 0; tries < 12 && !onRug({ x: seat.x + dx * t, y: seat.y + dy * t }, rug); tries++) t /= 2;
  if (!onRug({ x: seat.x + dx * t, y: seat.y + dy * t }, rug)) return room;
  return { ...room, seats: room.seats.map((s) => (s.id === seatId ? { ...s, x: s.x + dx * t, y: s.y + dy * t } : s)) };
}

/** Takes one spot off the rug. */
export function removeSpot(room: DocRoom, seatId: string): DocRoom {
  const labels = { ...room.labels };
  delete labels[seatId];
  return {
    ...room,
    seats: room.seats.filter((seat) => seat.id !== seatId),
    labels,
    handSetLabels: room.handSetLabels.filter((id) => id !== seatId),
  };
}

function layoutPieces(room: DocRoom): DocPiece[] {
  return room.pieces.filter((piece) => isLayoutPiece(piece.id));
}

/**
 * True when a desk or seat was moved, turned, added or removed since the
 * layout was placed. Only the layout's own shape counts: the whole layout
 * sliding when the room is resized is not a change.
 */
export function isLayoutChanged(room: DocRoom, layout: Layout): boolean {
  if (!room.layout) return false;
  if (Math.abs(room.layout.size - (room.layout.fitted ?? fittedSize(room, layout))) > 0.001) return true;
  const fresh = placeLayout(room, layout, room.layout.size);
  const now = layoutPieces(room);
  const then = layoutPieces(fresh);
  if (now.length !== then.length || room.seats.length !== fresh.seats.length) return true;
  const corner = (pieces: DocPiece[]) => ({ x: Math.min(...pieces.map((piece) => piece.x)), y: Math.min(...pieces.map((piece) => piece.y)) });
  const nowCorner = corner(now);
  const thenCorner = corner(then);
  const moved = (a: { x: number; y: number } | undefined, b: { x: number; y: number }) =>
    !a ||
    Math.abs(a.x - thenCorner.x - (b.x - nowCorner.x)) > SAME_PLACE ||
    Math.abs(a.y - thenCorner.y - (b.y - nowCorner.y)) > SAME_PLACE;
  const pieceById = new Map(then.map((piece) => [piece.id, piece]));
  const seatById = new Map(fresh.seats.map((seat) => [seat.id, seat]));
  return (
    now.some((piece) => moved(pieceById.get(piece.id), piece) || pieceById.get(piece.id)?.rotation !== piece.rotation) ||
    room.seats.some((seat) => moved(seatById.get(seat.id), seat))
  );
}

/** Takes the layout out of the room, saving the teacher's version if it was changed. */
export function setLayoutAside(room: DocRoom, layout: Layout | null): DocRoom {
  const saved = { ...(room.savedLayouts ?? {}) };
  if (room.layout && layout && isLayoutChanged(room, layout)) {
    delete saved[room.layout.id];
    saved[room.layout.id] = { size: room.layout.size, pieces: layoutPieces(room), seats: room.seats };
    // Keep the most recent ones (objects keep insertion order).
    const ids = Object.keys(saved);
    for (const old of ids.slice(0, Math.max(0, ids.length - MAX_SAVED_LAYOUTS))) delete saved[old];
  }
  return {
    ...room,
    pieces: room.pieces.filter((piece) => !isLayoutPiece(piece.id)),
    seats: [],
    labels: {},
    handSetLabels: [],
    layout: null,
    savedLayouts: saved,
  };
}

/** Puts a layout in the room: the saved version if it was changed before, a fresh fit otherwise. */
export function chooseLayout(room: DocRoom, layout: Layout, current: Layout | null): DocRoom {
  const cleared = setLayoutAside(room, current);
  const saved = cleared.savedLayouts?.[layout.id];
  if (!saved) return placeLayout(cleared, layout, fittedSize(cleared, layout));
  const rest = { ...cleared.savedLayouts };
  delete rest[layout.id];
  return keepGroupsInside({
    ...cleared,
    pieces: [...cleared.pieces, ...saved.pieces],
    seats: saved.seats,
    layout: { id: layout.id, size: saved.size },
    savedLayouts: rest,
    locked: false,
  });
}
