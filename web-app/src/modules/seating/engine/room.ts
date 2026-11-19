import type { Furniture, Seat } from '@modules/layouts/types';

import { closenessOf, spotsInUse } from './closeness';
import type { Zone } from './closeness';
import { distanceToSegment } from './geometry';
import { linkSeats } from './neighbors';
import { DEFAULT_SETTINGS } from './settings';
import type { EngineSettings } from './settings';
import type { Point, Segment, TeacherSpot } from './types';

export type { Zone } from './closeness';

export type RoomSeat = Point & {
  id: string;
  index: number;
  furnitureId: string;
  facing: number;
  // 1 = faces the board, 0 = sideways, -1 = faces the back wall.
  facingFront: number;
  closeness: number;
  desksFromTeacher: number;
  zone: Zone;
};

export type Room = {
  seats: RoomSeat[];
  seatIndex: Map<string, number>;
  neighbors: number[][];
  close: number[][];
  groupOf: Int32Array;
  groups: number[][];
  // Each seat's place in a ranking, from 0 (first) to 1 (last).
  frontRank: Float64Array;
  closenessRank: Float64Array;
  // Null when no door is drawn.
  doorRank: Float64Array | null;
  facesFront: boolean[];
  deskWidth: number;
  settings: EngineSettings;
};

export type RoomInput = {
  seats: Seat[];
  furniture: Furniture[];
  teacherSpots: TeacherSpot[];
  doors?: Segment[];
  // How many layout units one desk is wide; layouts can be shrunk to fit a room.
  deskWidth?: number;
  // The front wall; the front of the room is always at the top.
  frontY?: number;
  settings?: EngineSettings;
};

// Closeness scores this close are a tie.
const SAME_SCORE = 1e-6;

function checkPositions(points: { id: string; x: number; y: number }[]): void {
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error(`${point.id} has an invalid position`);
    }
  }
}

// Each seat's position in the order given by `value` (ascending), as 0 to 1.
// Seats within `tolerance` of each other (e.g. one row) share the best
// position among them, so a whole front row counts as the front and seat
// numbering never decides it.
function rankShares(count: number, value: (index: number) => number, tolerance: number): Float64Array {
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => value(a) - value(b));
  const shares = new Float64Array(count);
  let start = 0;
  while (start < count) {
    let end = start + 1;
    while (end < count && value(order[end]) - value(order[start]) <= tolerance) end++;
    for (let i = start; i < end; i++) shares[order[i]] = count > 1 ? start / (count - 1) : 0;
    start = end;
  }
  return shares;
}

export function buildRoom(input: RoomInput): Room {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const deskWidth = input.deskWidth ?? 1;
  const { seats, furniture } = input;
  checkPositions([...seats, ...input.teacherSpots]);

  const xs = seats.map((s) => s.x);
  const frontMiddle = { x: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, y: input.frontY ?? 0 };
  const spots = spotsInUse(input.teacherSpots, frontMiddle, settings);
  const roomSeats: RoomSeat[] = seats.map((seat, index) => ({
    id: seat.id,
    index,
    x: seat.x,
    y: seat.y,
    furnitureId: seat.furnitureId,
    facing: seat.facing,
    facingFront: Math.cos((seat.facing * Math.PI) / 180),
    ...closenessOf(seat, spots, deskWidth, settings),
  }));

  const doors = input.doors ?? [];
  const doorDistance = (i: number) => Math.min(...doors.map((d) => distanceToSegment(roomSeats[i], d.a, d.b)));
  const links = linkSeats(seats, furniture, deskWidth, settings);
  const sameRow = settings.ranking.sameRowDesks * deskWidth;

  return {
    seats: roomSeats,
    seatIndex: new Map(roomSeats.map((s) => [s.id, s.index])),
    ...links,
    frontRank: rankShares(seats.length, (i) => roomSeats[i].y, sameRow),
    closenessRank: rankShares(seats.length, (i) => -roomSeats[i].closeness, SAME_SCORE),
    doorRank: doors.length > 0 ? rankShares(seats.length, doorDistance, sameRow) : null,
    facesFront: roomSeats.map((s) => s.facingFront >= settings.facing.facesFrontAt),
    deskWidth,
    settings,
  };
}
