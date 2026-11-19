import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { placeLayout } from '@modules/room/layoutPlacement';
import { namePlaces, shownNames } from '@modules/seats/seatNames';
import { emptyDoc, student } from '@test/classroomDocs';

describe('names on the Seats drawing', () => {
  it('shows first names, with a last initial only when two share one', () => {
    const names = shownNames([student('a', 'Ava Rossi'), student('b', 'Ava Chen'), student('c', 'Leo Park'), student('d', 'Mia')]);
    expect([...names.values()]).toEqual(['Ava R.', 'Ava C.', 'Leo', 'Mia']);
  });

  it('puts a name in the middle of a desk for one', () => {
    const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;
    const room = placeLayout(emptyDoc().room, traditional, 1);
    const seat = room.seats[0];
    const desk = room.pieces.find((piece) => piece.id === seat.furnitureId)!;
    const place = namePlaces(room).get(seat.id)!;
    expect(place.x).toBeCloseTo(desk.x, 0);
    expect(place.width).toBeGreaterThan(0);
  });
});
