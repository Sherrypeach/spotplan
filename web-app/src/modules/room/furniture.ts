import type { DocPiece, DocRoom, DocSpot } from '@modules/classroom/document';
import { frontOf, pointFromFrontUp, quartersBetween, toFrontUp } from '@modules/room/frontFrame';
import { cutBox, nearestPoint, pieceBox } from '@modules/room/roomGeometry';
import { MAX_PIECES } from '@modules/room/roomGroups';
import { MAX_SPOTS } from '@modules/room/teacherSpots';
import { UNITS_PER_FOOT } from '@modules/room/units';

/** Furniture the teacher can add to the room, and spend time at. */
export type FurnitureKind = 'teacher-desk' | 'rug' | 'bookshelf' | 'sink';

// The teacher's chair comes with My desk, joined to it until the teacher splits them.
const CHAIR = { kind: 'teacher-chair', label: 'My chair', feet: 1.6 } as const;

export const FURNITURE: { kind: FurnitureKind; label: string; feet: { w: number; h: number }; time: DocSpot['time'] }[] = [
  { kind: 'teacher-desk', label: 'My desk', feet: { w: 5, h: 2.5 }, time: 'sometimes' },
  { kind: 'rug', label: 'Rug', feet: { w: 8, h: 6 }, time: 'sometimes' },
  { kind: 'bookshelf', label: 'Shelves', feet: { w: 4, h: 1.25 }, time: 'not-much' },
  { kind: 'sink', label: 'Coffee station', feet: { w: 3, h: 2 }, time: 'not-much' },
];

const OLD_TABLE = { kind: 'small-group-table', label: 'Meeting table' } as const;

// Ids of furniture: "F-rug1", "F-teacher-desk2".
const FURNITURE_PREFIX = 'F-';
// Furniture may stand this close to a wall.
const FURNITURE_WALL_GAP = UNITS_PER_FOOT * 0.1;
// How far a chair drawn at a piece reaches past its edge, as a share of the piece's short side.
export const FURNITURE_CHAIR_SHARE = 0.34;
// Most furniture a room can have.
const MAX_FURNITURE = 12;

export function isFurniture(piece: { id: string }): boolean {
  return piece.id.startsWith(FURNITURE_PREFIX);
}

export function furnitureOf(room: Pick<DocRoom, 'pieces'>): DocPiece[] {
  return room.pieces.filter(isFurniture);
}

function furnitureLabel(piece: { kind: string }): string {
  if (piece.kind === CHAIR.kind) return CHAIR.label;
  // Rooms saved before the small-group table was taken off the list still name theirs.
  if (piece.kind === OLD_TABLE.kind) return OLD_TABLE.label;
  return FURNITURE.find((entry) => entry.kind === piece.kind)?.label ?? 'Furniture';
}

/** The pieces joined to this one (My desk and its chair), itself first. */
function joinedWith(room: Pick<DocRoom, 'pieces'>, piece: DocPiece): DocPiece[] {
  if (!piece.group) return [piece];
  return [piece, ...furnitureOf(room).filter((other) => other.id !== piece.id && other.group === piece.group)];
}

/** Whether the piece can be split from what it's joined to. */
export function canSplitFurniture(room: Pick<DocRoom, 'pieces'>, piece: DocPiece): boolean {
  return joinedWith(room, piece).length > 1;
}

/**
 * The chair, and anything else joined to it, becomes its own piece. The
 * chair is pulled out from under My desk, so it's plain they're apart.
 */
export function splitFurniture(room: DocRoom, id: string): DocRoom {
  const piece = room.pieces.find((candidate) => candidate.id === id);
  if (!piece?.group) return room;
  const group = piece.group;
  const desk = room.pieces.find((other) => other.group === group && other.kind === 'teacher-desk');
  const split: DocRoom = {
    ...room,
    pieces: room.pieces.map((other) => {
      if (other.group !== group || !isFurniture(other)) return other;
      const loose = { ...other };
      delete loose.group;
      return loose;
    }),
  };
  const chair = split.pieces.find((other) => other.kind === CHAIR.kind && room.pieces.find((was) => was.id === other.id)?.group === group);
  if (!desk || !chair) return split;
  const radians = (desk.rotation * Math.PI) / 180;
  const away = desk.h / 2 + chair.h / 2 + FURNITURE_WALL_GAP * 2;
  return settled(split, { ...chair, x: desk.x + away * Math.sin(radians), y: desk.y - away * Math.cos(radians) });
}

/** The piece's name in this room, numbered when there's more than one of its kind ("Small-group table 2"). */
export function furnitureName(room: Pick<DocRoom, 'pieces'>, piece: DocPiece): string {
  const same = furnitureOf(room).filter((other) => other.kind === piece.kind);
  return same.length > 1 ? `${furnitureLabel(piece)} ${same.findIndex((other) => other.id === piece.id) + 1}` : furnitureLabel(piece);
}

/** "your desk or a rug": the furniture a teacher spends time at, for hints. */
export function furnitureKindsList(): string {
  // Only the places a teacher spends time at; shelves and the sink are just there.
  const names = FURNITURE.filter((entry) => entry.time !== 'not-much').map((entry) => (entry.kind === 'teacher-desk' ? 'your desk' : `a ${entry.label.toLowerCase()}`));
  return `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

function nextId(room: DocRoom, kind: string): string {
  const used = room.pieces
    .map((piece) => new RegExp(`^${FURNITURE_PREFIX}${kind}(\\d+)$`).exec(piece.id)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return `${FURNITURE_PREFIX}${kind}${used.length ? Math.max(...used) + 1 : 1}`;
}

function nextSpotId(room: DocRoom): string {
  const used = room.spots.map((spot) => /^spot(\d+)$/.exec(spot.id)?.[1]).filter((n): n is string => n !== undefined).map(Number);
  return `spot${used.length ? Math.max(...used) + 1 : 1}`;
}

type Box = { left: number; top: number; right: number; bottom: number };

function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Where the piece's middle goes so all of it stays on the floor: inside the
 * walls (it may stand against them), and out of an L-shaped room's missing
 * corner by the shortest way, or in the middle of the bigger open part when
 * no way out fits.
 */
function onFloor(room: DocRoom, piece: DocPiece): { x: number; y: number } {
  const box = pieceBox(piece);
  const halfW = (box.right - box.left) / 2;
  const halfH = (box.bottom - box.top) / 2;
  const clampX = (x: number) => Math.min(Math.max(x, halfW + FURNITURE_WALL_GAP), room.width - halfW - FURNITURE_WALL_GAP);
  const clampY = (y: number) => Math.min(Math.max(y, halfH + FURNITURE_WALL_GAP), room.depth - halfH - FURNITURE_WALL_GAP);
  const at = { x: clampX(piece.x), y: clampY(piece.y) };
  const cut = cutBox(room);
  const boxAt = (p: { x: number; y: number }) => ({ left: p.x - halfW, right: p.x + halfW, top: p.y - halfH, bottom: p.y + halfH });
  if (!cut || !boxesOverlap(boxAt(at), cut)) return at;
  const ways = [
    { x: cut.left - halfW - FURNITURE_WALL_GAP, y: at.y },
    { x: cut.right + halfW + FURNITURE_WALL_GAP, y: at.y },
    { x: at.x, y: cut.top - halfH - FURNITURE_WALL_GAP },
    { x: at.x, y: cut.bottom + halfH + FURNITURE_WALL_GAP },
  ].filter((p) => p.x === clampX(p.x) && p.y === clampY(p.y) && !boxesOverlap(boxAt(p), cut));
  const nearest = nearestPoint(at, ways);
  if (nearest) return nearest;
  // Nothing fits beside the cut: the middle of the bigger open part of the L.
  const wide = cut.top <= 0 ? { top: cut.bottom, bottom: room.depth } : { top: 0, bottom: cut.top };
  const deep = cut.left <= 0 ? { left: cut.right, right: room.width } : { left: 0, right: cut.left };
  const wideArea = room.width * (wide.bottom - wide.top);
  const deepArea = room.depth * (deep.right - deep.left);
  return wideArea >= deepArea ? { x: room.width / 2, y: (wide.top + wide.bottom) / 2 } : { x: (deep.left + deep.right) / 2, y: room.depth / 2 };
}

/** The piece moved so all of it stays on the floor, and its place for the teacher with it. */
function settled(room: DocRoom, piece: DocPiece): DocRoom {
  const at = onFloor(room, piece);
  const moved = { ...piece, x: Math.round(at.x), y: Math.round(at.y) };
  return {
    ...room,
    pieces: room.pieces.map((other) => (other.id === piece.id ? moved : other)),
    spots: room.spots.map((spot) => (spot.pieceId === piece.id ? { ...spot, x: moved.x, y: moved.y } : spot)),
  };
}

/**
 * Puts pieces that go together (My desk and its chair) where asked, then
 * slides them all by the same amount so the one furthest out is back on the
 * floor: they never come apart against a wall.
 */
function settledTogether(room: DocRoom, placed: DocPiece[]): DocRoom {
  let shiftX = 0;
  let shiftY = 0;
  for (const piece of placed) {
    const at = onFloor(room, piece);
    if (Math.abs(at.x - piece.x) > Math.abs(shiftX)) shiftX = at.x - piece.x;
    if (Math.abs(at.y - piece.y) > Math.abs(shiftY)) shiftY = at.y - piece.y;
  }
  const byId = new Map(placed.map((piece) => [piece.id, { ...piece, x: Math.round(piece.x + shiftX), y: Math.round(piece.y + shiftY) }]));
  return {
    ...room,
    pieces: room.pieces.map((other) => byId.get(other.id) ?? other),
    spots: room.spots.map((spot) => {
      const moved = spot.pieceId ? byId.get(spot.pieceId) : undefined;
      return moved ? { ...spot, x: moved.x, y: moved.y } : spot;
    }),
  };
}

// Where new furniture is tried, as shares of the room seen with the board at the top: the back half first.
/**
 * Whether any of these pieces lands on other furniture. A rug lies under
 * things, so anything may stand on it; pieces joined together (My desk and
 * its chair) don't count against each other.
 */
function onOtherFurniture(room: DocRoom, ids: string[]): boolean {
  const moving = room.pieces.filter((piece) => ids.includes(piece.id) && piece.kind !== 'rug');
  const others = furnitureOf(room).filter((piece) => !ids.includes(piece.id) && piece.kind !== 'rug');
  return moving.some((piece) => others.some((other) => boxesOverlap(pieceBox(piece), pieceBox(other))));
}

// When none of the first spots is free, the floor is searched in steps this many feet apart, back to front.
const SEARCH_STEP_FEET = 1;

const NEW_SPOTS = [
  { x: 0.5, y: 0.7 },
  { x: 0.25, y: 0.7 },
  { x: 0.75, y: 0.7 },
  { x: 0.5, y: 0.85 },
  { x: 0.25, y: 0.85 },
  { x: 0.75, y: 0.85 },
];

/** Whether another piece of furniture fits: under the limits on furniture, pieces and the teacher's places. */
export function canAddFurniture(room: DocRoom): boolean {
  return furnitureOf(room).length < MAX_FURNITURE && room.pieces.length < MAX_PIECES && room.spots.length < MAX_SPOTS;
}

/** Adds a piece of furniture in the back half of the room, clear of other furniture, with a place for the teacher on it. */
export function addFurniture(room: DocRoom, kind: FurnitureKind): DocRoom {
  const entry = FURNITURE.find((candidate) => candidate.kind === kind)!;
  if (!canAddFurniture(room)) return room;
  const up = toFrontUp(room);
  const base: DocPiece = {
    id: nextId(room, kind),
    kind,
    x: 0,
    y: 0,
    w: entry.feet.w * UNITS_PER_FOOT,
    h: entry.feet.h * UNITS_PER_FOOT,
    // Turned so it faces the board like the room does.
    rotation: (90 * quartersBetween('top', frontOf(room))) % 360,
    flipH: false,
  };
  const others = furnitureOf(room).filter((other) => other.kind !== 'rug').map(pieceBox);
  const tries = NEW_SPOTS.map((share) => ({ ...base, ...onFloor(room, { ...base, ...pointFromFrontUp(room, { x: up.width * share.x, y: up.depth * share.y }) }) }));
  const free = (candidate: DocPiece) => kind === 'rug' || !others.some((other) => boxesOverlap(pieceBox(candidate), other));
  const step = SEARCH_STEP_FEET * UNITS_PER_FOOT;
  const search = function* () {
    for (let y = up.depth - step; y > 0; y -= step)
      for (let x = step; x < up.width; x += step) yield { ...base, ...onFloor(room, { ...base, ...pointFromFrontUp(room, { x, y }) }) };
  };
  let piece = tries.find(free);
  if (!piece) for (const candidate of search()) if (free(candidate)) { piece = candidate; break; }
  piece ??= tries[0];
  const spot = { id: nextSpotId(room), x: piece.x, y: piece.y, time: entry.time, pieceId: piece.id };
  const added = settled({ ...room, pieces: [...room.pieces, piece], spots: [...room.spots, spot] }, piece);
  if (kind !== 'teacher-desk' || added.pieces.length >= MAX_PIECES) return added;
  return withChair(added, added.pieces.at(-1)!);
}

/** My desk with its chair on the board side, joined to it. */
function withChair(room: DocRoom, piece: DocPiece, existing?: DocPiece): DocRoom {
  const desk = { ...piece, group: piece.group ?? piece.id };
  const size = CHAIR.feet * UNITS_PER_FOOT;
  // Tucked in: half the chair sits under the desk, as it does in a classroom.
  const back = desk.h / 2;
  const radians = (desk.rotation * Math.PI) / 180;
  const chair: DocPiece = {
    id: existing?.id ?? nextId(room, CHAIR.kind),
    kind: CHAIR.kind,
    x: desk.x + back * Math.sin(radians),
    y: desk.y - back * Math.cos(radians),
    w: size,
    h: size,
    rotation: desk.rotation,
    flipH: false,
    group: desk.group,
  };
  const pieces = room.pieces.filter((other) => other.id !== existing?.id).map((other) => (other.id === desk.id ? desk : other));
  return settledTogether({ ...room, pieces: [...pieces, chair] }, [desk, chair]);
}

/** My desk and the chair pulled out from it, when there's one of each to put back together. */
function loosePair(room: Pick<DocRoom, 'pieces'>): { desk: DocPiece; chair: DocPiece } | null {
  const chair = room.pieces.find((other) => other.kind === CHAIR.kind && !other.group);
  const desk = room.pieces.find((other) => other.kind === 'teacher-desk' && joinedWith(room, other).every((joined) => joined.kind !== CHAIR.kind));
  return chair && desk ? { desk, chair } : null;
}

/** Whether this desk or chair can go back together with the other. */
export function canRejoinChair(room: Pick<DocRoom, 'pieces'>, piece: DocPiece): boolean {
  const pair = loosePair(room);
  return Boolean(pair) && (piece.id === pair!.desk.id || piece.id === pair!.chair.id);
}

/** Puts the chair back under My desk, joined to it again. */
export function rejoinChair(room: DocRoom, id: string): DocRoom {
  const pair = loosePair(room);
  if (!pair || (id !== pair.desk.id && id !== pair.chair.id)) return room;
  return withChair(room, pair.desk, pair.chair);
}

/** Whether My desk has lost its chair (split off and removed, or added before chairs came with it). */
export function canAddChair(room: Pick<DocRoom, 'pieces'>, piece: DocPiece): boolean {
  // A chair already pulled out stays the only one: no second chair.
  const looseChair = room.pieces.some((other) => other.kind === CHAIR.kind && !other.group);
  return piece.kind === 'teacher-desk' && !looseChair && joinedWith(room, piece).every((other) => other.kind !== CHAIR.kind) && room.pieces.length < MAX_PIECES;
}

/** Gives My desk a chair again, joined to it. */
export function addChair(room: DocRoom, id: string): DocRoom {
  const piece = room.pieces.find((candidate) => candidate.id === id);
  return piece && canAddChair(room, piece) ? withChair(room, piece) : room;
}

/** Moves a piece, and what's joined to it along with it. */
export function moveFurniture(room: DocRoom, id: string, point: { x: number; y: number }): DocRoom {
  const piece = room.pieces.find((candidate) => candidate.id === id);
  if (!piece) return room;
  const [dx, dy] = [point.x - piece.x, point.y - piece.y];
  const members = joinedWith(room, piece);
  const moved = settledTogether(
    room,
    members.map((other) => ({ ...other, x: other.x + dx, y: other.y + dy })),
  );
  // Furniture never lands on other furniture: the move doesn't happen.
  return onOtherFurniture(moved, members.map((member) => member.id)) ? room : moved;
}

/** A quarter turn, of the piece and what's joined to it, around the piece's middle. */
export function turnFurniture(room: DocRoom, id: string, degrees = 90): DocRoom {
  const piece = room.pieces.find((candidate) => candidate.id === id);
  if (!piece) return room;
  // Clockwise on screen (y points down), around the piece's middle; a quarter turn takes (x, y) to (-y, x).
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  const members = joinedWith(room, piece);
  const turned = settledTogether(
    room,
    members.map((other) => ({
      ...other,
      x: piece.x + (other.x - piece.x) * cos - (other.y - piece.y) * sin,
      y: piece.y + (other.x - piece.x) * sin + (other.y - piece.y) * cos,
      rotation: (((other.rotation + degrees) % 360) + 360) % 360,
    })),
  );
  return onOtherFurniture(turned, members.map((member) => member.id)) ? room : turned;
}

/** Removes a piece, and what's joined to it (My desk takes its chair along). */
export function removeFurniture(room: DocRoom, id: string): DocRoom {
  const piece = room.pieces.find((candidate) => candidate.id === id);
  const gone = new Set(piece ? joinedWith(room, piece).map((other) => other.id) : [id]);
  return { ...room, pieces: room.pieces.filter((other) => !gone.has(other.id)), spots: room.spots.filter((spot) => !spot.pieceId || !gone.has(spot.pieceId)) };
}

/** After the walls change, every piece of furniture goes back onto the floor. */
export function keepFurnitureInside(room: DocRoom): DocRoom {
  const done = new Set<string>();
  return furnitureOf(room).reduce((next, piece) => {
    if (done.has(piece.id)) return next;
    const members = joinedWith(next, next.pieces.find((p) => p.id === piece.id)!);
    members.forEach((member) => done.add(member.id));
    return settledTogether(next, members);
  }, room);
}
