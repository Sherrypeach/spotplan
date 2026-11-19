import type { DocRoom, DocStudent } from '@modules/classroom/document';
import { firstNamesOnly } from '@modules/classroom/roster/names';
import { boxOfPoints, pieceOutline } from '@modules/room/roomGeometry';
import { deskUnit } from '@modules/room/roomGroups';

// How far a name at a table moves from its chair toward the table's middle, so it sits on the table.
const TOWARD_TABLE = 0.45;
// Names use at most this share of the room they have, leaving a gap to the next one.
const ROOM_SHARE = 0.92;
// A name never gets more room than this, in desk widths, even with no seat nearby.
const MAX_NAME_SPACE = 1.2;

/** First names, with enough of the last name to tell apart students who share one ("Ava R.", "Ava C."). */
export function shownNames(students: DocStudent[]): Map<string, string> {
  const short = firstNamesOnly(students.map((student) => student.name));
  return new Map(students.map((student, index) => [student.id, short[index]]));
}

/**
 * Where each seat's name is drawn, flat: in the middle of a desk for one, on
 * the table near the chair at a bigger table, at the spot on a rug. Width is
 * the room the name has before it would run into the next one.
 */
export function namePlaces(room: DocRoom): Map<string, { x: number; y: number; width: number }> {
  const pieces = new Map(room.pieces.map((piece) => [piece.id, piece]));
  const seatsOn = new Map<string, number>();
  for (const seat of room.seats) seatsOn.set(seat.furnitureId, (seatsOn.get(seat.furnitureId) ?? 0) + 1);
  const widest = deskUnit(room) * MAX_NAME_SPACE;
  const places = new Map<string, { x: number; y: number; width: number }>();
  for (const seat of room.seats) {
    const nearest = Math.min(widest, ...room.seats.filter((other) => other.id !== seat.id).map((other) => Math.hypot(other.x - seat.x, other.y - seat.y)));
    const piece = pieces.get(seat.furnitureId);
    if (!piece || piece.kind === 'carpet') {
      places.set(seat.id, { x: seat.x, y: seat.y, width: nearest * ROOM_SHARE });
      continue;
    }
    const outline = pieceOutline(piece);
    const box = boxOfPoints(outline);
    const middle = { x: outline.reduce((sum, p) => sum + p.x, 0) / outline.length, y: outline.reduce((sum, p) => sum + p.y, 0) / outline.length };
    const across = (box.right - box.left) * ROOM_SHARE;
    if (seatsOn.get(piece.id) === 1) places.set(seat.id, { ...middle, width: across });
    else
      places.set(seat.id, {
        x: seat.x + (middle.x - seat.x) * TOWARD_TABLE,
        y: seat.y + (middle.y - seat.y) * TOWARD_TABLE,
        width: Math.min(across, nearest * ROOM_SHARE),
      });
  }
  return places;
}
