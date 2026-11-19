import type { ClassroomDocument } from '@modules/classroom/document';

/**
 * Keeps who-sits-where in step with the room. Seat ids repeat across layouts
 * (every layout numbers its seats from 1) and freed desk numbers get reused,
 * so a seating left behind would put students on unrelated new seats:
 * - a new layout with the seating untouched clears it;
 * - seats that are gone drop their student and their lock.
 */
export function keepSeatingInRoom(before: ClassroomDocument, after: ClassroomDocument): ClassroomDocument {
  if (after.room.seats === before.room.seats && after.room.layout?.id === before.room.layout?.id) return after;
  if (after.room.layout?.id !== before.room.layout?.id && after.seating === before.seating) {
    return { ...after, seating: { ...after.seating, assignment: {}, lockedSeats: [] } };
  }
  const seatIds = new Set(after.room.seats.map((seat) => seat.id));
  const { assignment, lockedSeats } = after.seating;
  const gone = Object.keys(assignment).filter((seat) => !seatIds.has(seat));
  if (gone.length === 0 && lockedSeats.every((seat) => seatIds.has(seat))) return after;
  const kept = Object.fromEntries(Object.entries(assignment).filter(([seat]) => seatIds.has(seat)));
  return { ...after, seating: { ...after.seating, assignment: kept, lockedSeats: lockedSeats.filter((seat) => seatIds.has(seat)) } };
}
