import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { piecesOutsideWalls, placeLayout } from '@modules/room/layoutPlacement';
import { floorOutline } from '@modules/room/roomGeometry';
import { resetRoom, resizedRoom, setCutCorner, setCutFeet, setRoomFeet, setRoomShape, shapeSummary } from '@modules/room/roomEdits';
import { fromFeet, toFeet } from '@modules/room/units';
import { addFurniture } from '@modules/room/furniture';
import { addFeature } from '@modules/room/wallFeatures';
import { emptyDoc } from '@test/classroomDocs';

describe('room edits', () => {
  it('starts as a 30 × 24 ft rectangle', () => {
    expect(shapeSummary(emptyDoc().room)).toBe('Rectangle · 30 × 24 ft');
  });

  it('sets the size in feet, within 10 to 80 ft', () => {
    const doc = setRoomFeet(emptyDoc(), { width: 32, depth: 5 });
    expect(toFeet(doc.room.width)).toBe(32);
    expect(toFeet(doc.room.depth)).toBe(10);
  });

  it('makes an L with the back-right corner missing, a third of each side', () => {
    const { room } = setRoomShape(emptyDoc(), 'l-shape');
    expect(room.cutCorner).toBe('bottom-right');
    expect(toFeet(room.cutWidth!)).toBe(10);
    expect(toFeet(room.cutDepth!)).toBe(8);
    expect(floorOutline(room)).toHaveLength(6);
  });

  it('keeps the missing corner between 10% and 70% of each side', () => {
    const l = setRoomShape(emptyDoc(), 'l-shape');
    expect(toFeet(setCutFeet(l, { width: 1 }).room.cutWidth!)).toBe(3);
    expect(toFeet(setCutFeet(l, { width: 29 }).room.cutWidth!)).toBe(21);
  });

  it('forgets the missing corner when going back to a rectangle', () => {
    const l = setCutCorner(setRoomShape(emptyDoc(), 'l-shape'), 'top-left');
    const { room } = setRoomShape(l, 'rectangle');
    expect(room.cutCorner).toBeUndefined();
    expect(floorOutline(room)).toHaveLength(4);
  });

  it('keeps furniture inside the walls when the room shrinks', () => {
    const doc = emptyDoc();
    doc.room.pieces = [{ id: 'p1', kind: 'bookshelf', x: fromFeet(28), y: fromFeet(20), w: 60, h: 30, rotation: 0, flipH: false }];
    const { room } = setRoomFeet(doc, { width: 15, depth: 12 });
    expect(room.pieces[0].x).toBeLessThanOrEqual(room.width - 30);
    expect(room.pieces[0].y).toBeLessThanOrEqual(room.depth - 15);
  });

  it('resizes from dragged feet, kept within 10 to 80 ft', () => {
    const room = resizedRoom(emptyDoc().room, { width: 95, depth: 2 });
    expect([toFeet(room.width), toFeet(room.depth)]).toEqual([80, 10]);
  });

  it('moves furniture with the wall when the left or front wall is pulled', () => {
    const doc = emptyDoc();
    doc.room.pieces = [{ id: 'p1', kind: 'sink', x: fromFeet(25), y: fromFeet(20), w: 40, h: 40, rotation: 0, flipH: false }];
    const room = resizedRoom(doc.room, { width: 35, depth: 24, fromLeft: true });
    expect(room.pieces[0].x).toBe(fromFeet(25) + fromFeet(35) - fromFeet(30));
    expect(room.pieces[0].y).toBe(fromFeet(20));
  });
});

describe('tables and the missing corner of an L', () => {
  it('slides tables out of the corner when it goes missing or moves', () => {
    const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;
    const doc = emptyDoc();
    doc.room = placeLayout(doc.room, traditional, 0.6);
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      const l = setCutCorner(setRoomShape(doc, 'l-shape'), corner);
      expect(piecesOutsideWalls(l.room)).toEqual([]);
    }
  });
});

describe('clearing the room', () => {
  it('takes the desks away but keeps the manager’s desk, its spot, and the doors', () => {
    const layout = (library as LayoutLibrary).layouts[0];
    const room = addFeature(addFurniture(placeLayout(emptyDoc().room, layout, 1), 'teacher-desk'), 'door');
    const cleared = resetRoom(room);
    expect(cleared.seats).toEqual([]);
    expect(cleared.pieces.map((piece) => piece.kind).sort()).toEqual(['door', 'teacher-chair', 'teacher-desk']);
    expect(cleared.spots.every((spot) => spot.pieceId !== undefined)).toBe(true);
    expect(cleared.spots.length).toBeGreaterThan(0);
  });
});
