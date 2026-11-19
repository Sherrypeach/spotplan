import { describe, expect, it } from 'vitest';

import type { ClassroomDocument } from '@modules/classroom/document';
import { keepSeatingInRoom } from '@modules/classroom/roomSeating';
import { docWith, student } from '@test/classroomDocs';

function seated(): ClassroomDocument {
  const doc = docWith([student('a', 'Ann'), student('b', 'Ben')]);
  return {
    ...doc,
    room: {
      ...doc.room,
      layout: { id: 'pairs', size: 1 },
      seats: [
        { id: 'L-s1', furnitureId: 'L-d1', x: 0, y: 0, facing: 0 },
        { id: 'L-s2', furnitureId: 'L-d1', x: 50, y: 0, facing: 0 },
      ],
    },
    seating: { ...doc.seating, assignment: { 'L-s1': 'a', 'L-s2': 'b' }, lockedSeats: ['L-s1'] },
  };
}

describe('keeping the seating in step with the room', () => {
  it('drops the teammate and the lock of a seat that is gone', () => {
    const before = seated();
    const after = keepSeatingInRoom(before, { ...before, room: { ...before.room, seats: before.room.seats.slice(1) } });
    expect(after.seating.assignment).toEqual({ 'L-s2': 'b' });
    expect(after.seating.lockedSeats).toEqual([]);
  });

  it('clears the seating when another layout comes in, since seat ids repeat across layouts', () => {
    const before = seated();
    const after = keepSeatingInRoom(before, { ...before, room: { ...before.room, layout: { id: 'traditional', size: 1 } } });
    expect(after.seating.assignment).toEqual({});
    expect(after.seating.lockedSeats).toEqual([]);
  });

  it('keeps a seating that changes together with the layout, like an Undo', () => {
    const before = seated();
    const restored = { ...before.seating, assignment: { 'L-s1': 'b' }, lockedSeats: [] };
    const after = keepSeatingInRoom(before, { ...before, room: { ...before.room, layout: { id: 'traditional', size: 1 } }, seating: restored });
    expect(after.seating).toBe(restored);
  });

  it('leaves everything alone when the seats did not change', () => {
    const before = seated();
    const next = { ...before, students: [...before.students] };
    expect(keepSeatingInRoom(before, next)).toBe(next);
  });
});
