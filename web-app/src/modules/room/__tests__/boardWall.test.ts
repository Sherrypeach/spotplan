import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { setBoardWall } from '@modules/room/boardWall';
import { addFurniture, moveFurniture } from '@modules/room/furniture';
import { piecesOutsideWalls, placeLayout } from '@modules/room/layoutPlacement';
import { addTeacherSpot } from '@modules/room/teacherSpots';
import { addFeature, wallFeatures } from '@modules/room/wallFeatures';
import { engineRoom } from '@modules/seats/seatingModel';
import { emptyDoc } from '@test/classroomDocs';

const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;

function classroom() {
  const doc = emptyDoc();
  let room = addFeature(addFurniture(doc.room, 'teacher-desk'), 'door');
  room = addTeacherSpot(placeLayout(room, traditional, 0.8));
  return { ...doc, room };
}

describe('moving the board to another wall', () => {
  it('turns the desks to face it, so every seat still faces the front', () => {
    const doc = classroom();
    const before = engineRoom(doc.room).facesFront.filter(Boolean).length;
    for (const wall of ['right', 'bottom', 'left'] as const) {
      const moved = setBoardWall(doc, wall, traditional);
      expect(moved.room.front).toBe(wall);
      expect(engineRoom(moved.room).facesFront.filter(Boolean).length).toBe(before);
      expect(piecesOutsideWalls(moved.room)).toEqual([]);
    }
  });

  it('leaves the walls, doors and furniture where they are, and takes the marker by the board along', () => {
    const doc = classroom();
    const moved = setBoardWall(doc, 'left', traditional);
    expect(moved.room.width).toBe(doc.room.width);
    expect(wallFeatures(moved.room)).toEqual(wallFeatures(doc.room));
    expect(moved.room.pieces.find((piece) => piece.kind === 'teacher-desk')).toEqual(doc.room.pieces.find((piece) => piece.kind === 'teacher-desk'));
    const marker = moved.room.spots.find((spot) => !spot.pieceId)!;
    expect(marker.x).toBeLessThan(doc.room.width / 4);
  });

  it('takes the manager’s desk by the board along to the new wall, turned to match', () => {
    const doc = emptyDoc();
    let room = addFurniture(doc.room, 'teacher-desk');
    room = moveFurniture(room, room.pieces[0].id, { x: room.width / 2, y: 0 });
    const moved = setBoardWall({ ...doc, room }, 'left', null).room;
    const desk = moved.pieces[0];
    expect(desk.x).toBeLessThan(moved.width / 4);
    expect(desk.rotation).toBe(270);
    expect(moved.spots.find((spot) => spot.pieceId === desk.id)).toMatchObject({ x: desk.x, y: desk.y });
  });

  it('keeps hand-set seat labels when the board moves', () => {
    const doc = classroom();
    const seat = doc.room.seats[0].id;
    const labelled = { ...doc, room: { ...doc.room, labels: { [seat]: 1 as const }, handSetLabels: [seat] } };
    const moved = setBoardWall(labelled, 'right', traditional).room;
    expect(moved.labels[seat]).toBe(1);
    expect(moved.handSetLabels).toEqual([seat]);
  });

  it('turns a layout the manager changed as a whole, and leaves a marker far from the board where it is', () => {
    const doc = classroom();
    const [first] = doc.room.pieces.filter((piece) => piece.id.startsWith('L-'));
    const moved = { ...doc, room: { ...doc.room, pieces: doc.room.pieces.map((piece) => (piece.id === first.id ? { ...piece, x: piece.x + 10 } : piece)), spots: [{ id: 'spot1', x: doc.room.width / 2, y: doc.room.depth / 2, time: 'most' as const }] } };
    const after = setBoardWall(moved, 'bottom', traditional).room;
    expect(after.pieces.find((piece) => piece.id === first.id)!.rotation).toBe((first.rotation + 180) % 360);
    expect(after.spots[0]).toMatchObject({ x: doc.room.width / 2, y: doc.room.depth / 2 });
  });

  it('does nothing when the board is already on that wall', () => {
    const doc = classroom();
    expect(setBoardWall(doc, 'top', traditional)).toBe(doc);
  });
});
