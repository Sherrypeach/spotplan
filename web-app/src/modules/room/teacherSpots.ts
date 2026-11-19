import type { DocRoom, DocSpot } from '@modules/classroom/document';
import { boardPlace, frontOf, INWARD } from '@modules/room/frontFrame';
import { pointOnFloor } from '@modules/room/roomGeometry';
import { UNITS_PER_FOOT } from '@modules/room/units';
import { MAX_SPOTS } from '@shared/serverLimits';

export type SpotTime = DocSpot['time'];

export const SPOT_TIMES: { time: SpotTime; label: string }[] = [
  { time: 'most', label: 'Most of my time' },
  { time: 'sometimes', label: 'Sometimes' },
  { time: 'not-much', label: 'Not much' },
];

// The API keeps up to 15 spots.
export { MAX_SPOTS };
// The first marker starts this far in from the board.
const FIRST_SPOT_INSET = UNITS_PER_FOOT * 3;
// Spots stay this far inside the walls.
const WALL_GAP = UNITS_PER_FOOT;

function inside(room: DocRoom, x: number, y: number): { x: number; y: number } {
  return pointOnFloor(room, x, y, WALL_GAP);
}

function nextId(room: DocRoom): string {
  const used = room.spots.map((spot) => /^spot(\d+)$/.exec(spot.id)?.[1]).filter((n): n is string => n !== undefined).map(Number);
  return `spot${used.length ? Math.max(...used) + 1 : 1}`;
}

/** Where a teacher by the board stands: a few feet in from its middle, on the floor. */
export function spotByBoard(room: DocRoom): { x: number; y: number } {
  const board = boardPlace(room);
  const inward = INWARD[frontOf(room)];
  return inside(room, board.x + inward.x * FIRST_SPOT_INSET, board.y + inward.y * FIRST_SPOT_INSET);
}

/** The first spot starts at the front, by the board, where most teachers stand; more go in the middle. */
export function addTeacherSpot(room: DocRoom): DocRoom {
  if (room.spots.length >= MAX_SPOTS) return room;
  // The first marker (not one on furniture) starts at the front, where most teachers stand.
  const first = !room.spots.some((spot) => !spot.pieceId);
  const at = first ? spotByBoard(room) : inside(room, room.width / 2, room.depth / 2);
  const spot: DocSpot = { id: nextId(room), ...at, time: first ? 'most' : 'sometimes' };
  return { ...room, spots: [...room.spots, spot] };
}

export function moveTeacherSpot(room: DocRoom, id: string, x: number, y: number): DocRoom {
  return { ...room, spots: room.spots.map((spot) => (spot.id === id ? { ...spot, ...inside(room, x, y), pieceId: undefined } : spot)) };
}

export function setSpotTime(room: DocRoom, id: string, time: SpotTime): DocRoom {
  return { ...room, spots: room.spots.map((spot) => (spot.id === id ? { ...spot, time } : spot)) };
}

export function removeTeacherSpot(room: DocRoom, id: string): DocRoom {
  return { ...room, spots: room.spots.filter((spot) => spot.id !== id) };
}
