import type { DocPiece, DocRoom, WallSide } from '@modules/classroom/document';
import { boardLength, boardPlace, distanceToWall, frontOf } from '@modules/room/frontFrame';
import { cutBox } from '@modules/room/roomGeometry';
import { MAX_PIECES } from '@modules/room/roomGroups';
import { UNITS_PER_FOOT } from '@modules/room/units';

export type WallFeatureKind = 'door' | 'window';

// Ids of doors and windows: "W-door1", "W-window2".
const FEATURE_PREFIX = 'W-';
const LENGTH_FEET: Record<WallFeatureKind, number> = { door: 3, window: 5 };
// How thick a door or window is drawn into the wall.
const DEPTH_FEET = 0.5;
// Most doors and windows a room can have (the API allows up to 200 pieces in all).
export const MAX_FEATURES = 12;

export function isWallFeature(piece: { kind: string }): piece is DocPiece & { kind: WallFeatureKind } {
  return piece.kind === 'door' || piece.kind === 'window';
}

export function wallFeatures(room: Pick<DocRoom, 'pieces'>): DocPiece[] {
  return room.pieces.filter(isWallFeature);
}

/** The part of a wall that is really there: an L-shaped room's missing corner takes a piece off two walls. */
function solidPart(room: DocRoom, wall: WallSide): [number, number] {
  const across = wall === 'left' || wall === 'right';
  const length = across ? room.depth : room.width;
  const box = cutBox(room);
  if (!box || !room.cutCorner) return [0, length];
  const touches = across ? room.cutCorner.endsWith(wall) : room.cutCorner.startsWith(wall);
  if (!touches) return [0, length];
  const [from, to] = across ? [box.top, box.bottom] : [box.left, box.right];
  return from <= 0 ? [to, length] : [0, from];
}

/** Where a feature sits along its wall (its middle, in room units), kept inside the wall. */
function alongOf(piece: DocPiece): number {
  return piece.wall === 'left' || piece.wall === 'right' ? piece.y : piece.x;
}

/** The feature drawn on its wall at `along`, just inside the room. */
function onWall(room: DocRoom, piece: DocPiece, wall: WallSide, along: number): DocPiece {
  const half = piece.w / 2;
  const [from, to] = solidPart(room, wall);
  const middle = Math.min(Math.max(along, from + half), to - half);
  const inset = piece.h / 2;
  const at = {
    top: { x: middle, y: inset },
    bottom: { x: middle, y: room.depth - inset },
    left: { x: inset, y: middle },
    right: { x: room.width - inset, y: middle },
  }[wall];
  return { ...piece, ...at, wall, rotation: wall === 'left' || wall === 'right' ? 90 : 0 };
}

function nextId(room: DocRoom, kind: WallFeatureKind): string {
  const used = room.pieces
    .map((piece) => new RegExp(`^${FEATURE_PREFIX}${kind}(\\d+)$`).exec(piece.id)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return `${FEATURE_PREFIX}${kind}${used.length ? Math.max(...used) + 1 : 1}`;
}

/** Adds a door (on the back wall, across from the board) or a window (on the side wall to the class's left), where there's room for it. */
export function addFeature(room: DocRoom, kind: WallFeatureKind): DocRoom {
  if (wallFeatures(room).length >= MAX_FEATURES || room.pieces.length >= MAX_PIECES) return room;
  const order: WallSide[] = ['top', 'right', 'bottom', 'left'];
  const front = order.indexOf(frontOf(room));
  const wall = order[(front + (kind === 'door' ? 2 : 3)) % 4];
  const taken = wallFeatures(room).filter((piece) => piece.wall === wall).map(alongOf);
  const [from, to] = solidPart(room, wall);
  const middle = (from + to) / 2;
  const step = (to - from) / 10;
  // The first spot along the wall, from the middle out, that no other feature covers.
  const candidates = Array.from({ length: 9 }, (_, i) => middle + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step);
  const along = candidates.find((spot) => taken.every((other) => Math.abs(other - spot) > UNITS_PER_FOOT * LENGTH_FEET[kind])) ?? middle;
  const piece: DocPiece = {
    id: nextId(room, kind),
    kind,
    x: 0,
    y: 0,
    w: UNITS_PER_FOOT * LENGTH_FEET[kind],
    h: UNITS_PER_FOOT * DEPTH_FEET,
    rotation: 0,
    flipH: false,
    wall,
  };
  return { ...room, pieces: [...room.pieces, freeSpot(room, piece, wall, along) ?? onWall(room, piece, wall, along)] };
}

export function removeFeature(room: DocRoom, id: string): DocRoom {
  return { ...room, pieces: room.pieces.filter((piece) => piece.id !== id) };
}

/** The outer wall closest to a point. */
export function nearestWall(room: Pick<DocRoom, 'width' | 'depth'>, point: { x: number; y: number }): WallSide {
  const walls: WallSide[] = ['top', 'bottom', 'left', 'right'];
  return walls.reduce((best, wall) => (Math.abs(distanceToWall(room, wall, point)) < Math.abs(distanceToWall(room, best, point)) ? wall : best));
}

/** Moves a feature to the wall nearest `point`, at the spot along it nearest the point. */
export function moveFeature(room: DocRoom, id: string, point: { x: number; y: number }): DocRoom {
  const piece = room.pieces.find((candidate) => candidate.id === id);
  if (!piece) return room;
  const wall = nearestWall(room, point);
  const placed = freeSpot(room, piece, wall, wall === 'left' || wall === 'right' ? point.y : point.x);
  // No free stretch of wall left: it stays where it was.
  return placed ? { ...room, pieces: room.pieces.map((other) => (other.id === id ? placed : other)) } : room;
}

type Box = { left: number; top: number; right: number; bottom: number };

// The floor a door or window takes: its stretch of wall, and how far it reaches in (a door swings its own width).
function footprint(piece: DocPiece): Box {
  const half = piece.w / 2;
  const reach = piece.kind === 'door' ? piece.w : piece.h;
  const along = alongOf(piece);
  const [from, to] = [along - half, along + half];
  switch (piece.wall) {
    case 'left':
      return { left: 0, right: reach, top: from, bottom: to };
    case 'right':
      return { left: piece.x + piece.h / 2 - reach, right: piece.x + piece.h / 2, top: from, bottom: to };
    case 'bottom':
      return { left: from, right: to, top: piece.y + piece.h / 2 - reach, bottom: piece.y + piece.h / 2 };
    default:
      return { left: from, right: to, top: 0, bottom: reach };
  }
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// What a door or window must keep clear of: the other doors and windows (around corners too) and the board.
function obstacles(room: DocRoom, except: string): Box[] {
  const boxes = wallFeatures(room)
    .filter((other) => other.id !== except)
    .map(footprint);
  const board = boardPlace(room);
  const half = boardLength(room) / 2;
  const thick = UNITS_PER_FOOT;
  boxes.push(
    board.angle ? { left: board.x - thick, right: board.x + thick, top: board.y - half, bottom: board.y + half } : { left: board.x - half, right: board.x + half, top: board.y - thick, bottom: board.y + thick },
  );
  return boxes;
}

/** The piece on `wall`, at the free spot nearest `along`, or null when nothing on that wall is free. */
function freeSpot(room: DocRoom, piece: DocPiece, wall: WallSide, along: number): DocPiece | null {
  const blocked = obstacles(room, piece.id);
  const fits = (candidate: DocPiece) => blocked.every((box) => !boxesOverlap(footprint(candidate), box));
  const wanted = onWall(room, piece, wall, along);
  if (fits(wanted)) return wanted;
  // Just past either side of each obstacle, along this wall, nearest first.
  const across = wall === 'left' || wall === 'right';
  const half = piece.w / 2;
  const tries = blocked
    .flatMap((box) => (across ? [box.top - half, box.bottom + half] : [box.left - half, box.right + half]))
    .map((spot) => onWall(room, piece, wall, spot))
    .filter(fits)
    .sort((a, b) => Math.abs(alongOf(a) - along) - Math.abs(alongOf(b) - along));
  return tries[0] ?? null;
}

/** After the walls change, every door and window goes back onto its wall. */
export function keepFeaturesOnWalls(room: DocRoom): DocRoom {
  if (!room.pieces.some(isWallFeature)) return room;
  return { ...room, pieces: room.pieces.map((piece) => (isWallFeature(piece) && piece.wall ? onWall(room, piece, piece.wall, alongOf(piece)) : piece)) };
}

/** The doors as segments on the walls, for the seating engine's "near the door". */
export function doorSegments(room: Pick<DocRoom, 'pieces'>): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  return wallFeatures(room)
    .filter((piece) => piece.kind === 'door')
    .map((piece) =>
      piece.wall === 'left' || piece.wall === 'right'
        ? { a: { x: piece.x, y: piece.y - piece.w / 2 }, b: { x: piece.x, y: piece.y + piece.w / 2 } }
        : { a: { x: piece.x - piece.w / 2, y: piece.y }, b: { x: piece.x + piece.w / 2, y: piece.y } },
    );
}
