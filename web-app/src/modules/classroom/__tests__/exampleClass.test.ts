import { describe, expect, it } from 'vitest';

import { EXAMPLE_LAYOUT_ID, exampleClass } from '@modules/classroom/exampleClass';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { piecesOutsideWalls } from '@modules/room/layoutPlacement';
import { wallFeatures } from '@modules/room/wallFeatures';
import { checks, engineRoom, placeAll } from '@modules/seats/seatingModel';
import { emptyDoc } from '@test/classroomDocs';

const layout = (library as LayoutLibrary).layouts.find((candidate) => candidate.id === EXAMPLE_LAYOUT_ID)!;

describe('the example team', () => {
  it('brings the example’s 24 teammates, the manager’s spots, a door and the desks, all inside the room', () => {
    const doc = exampleClass(emptyDoc(), layout);
    expect(doc.students).toHaveLength(24);
    expect(doc.room.seats).toHaveLength(24);
    expect(doc.room.spots).toHaveLength(3);
    expect(wallFeatures(doc.room).map((piece) => piece.kind)).toEqual(['door']);
    expect(piecesOutsideWalls(doc.room)).toEqual([]);
    for (const spot of doc.room.spots) {
      expect(spot.x).toBeGreaterThanOrEqual(0);
      expect(spot.x).toBeLessThanOrEqual(doc.room.width);
    }
  });

  it('seats everyone with no need left unmet', () => {
    const doc = exampleClass(emptyDoc(), layout);
    const room = engineRoom(doc.room);
    const seated = placeAll(doc, room);
    const items = checks(seated, room);
    expect(items.filter((item) => item.kind === 'unseated' || item.kind === 'must-need-unmet')).toEqual([]);
  });
});
