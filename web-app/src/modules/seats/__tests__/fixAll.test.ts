import { describe, expect, it } from 'vitest';

import { EXAMPLE_LAYOUT_ID, exampleClass } from '@modules/classroom/exampleClass';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { checks, currentAssignment, engineRoom, fixAll, placeAll, swapSeats, toggleLock } from '@modules/seats/seatingModel';
import { emptyDoc } from '@test/classroomDocs';

const layout = (library as LayoutLibrary).layouts.find((candidate) => candidate.id === EXAMPLE_LAYOUT_ID)!;

function seatOf(doc: ReturnType<typeof emptyDoc>, studentId: string): string {
  const assignment = currentAssignment(doc);
  return Object.keys(assignment).find((seat) => assignment[seat] === studentId)!;
}

describe('fix what I can', () => {
  it('swaps until fewer things need checking, and leaves locked teammates where they are', () => {
    const start = exampleClass(emptyDoc(), layout);
    const room = engineRoom(start.room);
    const placed = placeAll(start, room);
    // A 1 and a 3 trade seats, so there's something to fix.
    const scrambled = swapSeats(placed, seatOf(placed, 'ex1'), seatOf(placed, 'ex24'));
    expect(checks(fixAll(scrambled, room), room).length).toBeLessThan(checks(scrambled, room).length);

    // Locking the misplaced 1 in place: the fix works around them and never moves them.
    const locked = toggleLock(scrambled, seatOf(scrambled, 'ex1'));
    const lockedSeat = seatOf(locked, 'ex1');
    expect(seatOf(fixAll(locked, room), 'ex1')).toBe(lockedSeat);
  });

  it('changes nothing when there is nothing to fix', () => {
    const start = exampleClass(emptyDoc(), layout);
    const room = engineRoom(start.room);
    const placed = placeAll(start, room);
    expect(checks(placed, room)).toEqual([]);
    expect(fixAll(placed, room)).toBe(placed);
  });
});
