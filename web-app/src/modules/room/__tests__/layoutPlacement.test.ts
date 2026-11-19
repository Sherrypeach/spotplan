import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import fixtures from '@test/fixtures/layouts.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import {
  addSeats,
  chooseLayout,
  fittedSize,
  isLayoutChanged,
  moveSpot,
  piecesOutsideWalls,
  piecesOverlapping,
  placeLayout,
  rugOf,
  scaleLayout,
  setLayoutAside,
} from '@modules/room/layoutPlacement';
import { onRug, pieceOutline } from '@modules/room/roomGeometry';
import { MAX_SEATS } from '@modules/room/roomGroups';
import { moveSelection } from '@modules/room/selection';
import { resizedRoom, setRoomFeet } from '@modules/room/roomEdits';
import { toFeet } from '@modules/room/units';
import { emptyDoc } from '@test/classroomDocs';

const layouts = (library as LayoutLibrary).layouts;
const traditional = layouts.find((layout) => layout.id === 'desks-traditional')!;

describe('placing a layout', () => {
  it('puts every desk and seat inside a 30 × 24 ft room at real size', () => {
    const room = emptyDoc().room;
    const size = fittedSize(room, traditional);
    expect(size).toBe(1);
    const placed = placeLayout(room, traditional, size);
    expect(placed.seats).toHaveLength(traditional.seats.length);
    expect(placed.layout).toEqual({ id: 'desks-traditional', size: 1, fitted: 1 });
    expect(piecesOutsideWalls(placed)).toEqual([]);
  });

  it('shrinks the layout to fit a small room', () => {
    const room = setRoomFeet(emptyDoc(), { width: 14, depth: 10 }).room;
    const size = fittedSize(room, traditional);
    expect(size).toBeLessThan(1);
    expect(piecesOutsideWalls(placeLayout(room, traditional, size))).toEqual([]);
  });

  it('pulls desks inside when the room shrinks afterwards, and flags the ones that end up on each other', () => {
    const doc = emptyDoc();
    doc.room = placeLayout(doc.room, traditional, 1);
    const smaller = setRoomFeet(doc, { width: 12 }).room;
    expect(piecesOutsideWalls(smaller)).toEqual([]);
    expect(piecesOverlapping(smaller).length).toBeGreaterThan(0);
  });

  it('keeps the manager’s own furniture when switching layouts', () => {
    const room = { ...emptyDoc().room, pieces: [{ id: 'mine', kind: 'bookshelf', x: 50, y: 50, w: 40, h: 20, rotation: 0, flipH: false }] };
    const pods = layouts.find((layout) => layout.name === 'Pods of 4')!;
    const switched = placeLayout(placeLayout(room, traditional, 1), pods, 1);
    expect(switched.pieces.filter((piece) => piece.id === 'mine')).toHaveLength(1);
    expect(switched.seats).toHaveLength(pods.seats.length);
  });
});

describe('seat count', () => {
  it('adds desks in open floor, each with one chair, without overlapping', () => {
    const room = placeLayout(emptyDoc().room, traditional, 1);
    const { room: more, added } = addSeats(room, 2);
    expect(added).toBe(2);
    expect(more.seats).toHaveLength(traditional.seats.length + 2);
    expect(piecesOutsideWalls(more)).toEqual([]);
  });

  it('never reuses an id, even after one is removed', () => {
    const room = placeLayout(emptyDoc().room, traditional, 1);
    const once = addSeats(room, 2).room;
    const fewer = { ...once, pieces: once.pieces.filter((piece) => piece.id !== 'A-d1'), seats: once.seats.filter((seat) => seat.id !== 'A-d1s') };
    const again = addSeats(fewer, 1).room;
    const ids = again.pieces.map((piece) => piece.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('A-d3');
  });

  it('stops at the most seats a room can have', () => {
    const room = setRoomFeet(emptyDoc(), { width: 80, depth: 80 }).room;
    const placed = placeLayout(room, traditional, 0.45);
    expect(addSeats(placed, 500).room.seats.length).toBeLessThanOrEqual(MAX_SEATS);
  });

  it('adds spots on the rug when the team sits on a rug', () => {
    const rug = (fixtures as unknown as LayoutLibrary).layouts.find((layout) => layout.category === 'carpets')!;
    const room = placeLayout(emptyDoc().room, rug, 1);
    const carpet = rugOf(room)!;
    const { room: more, added } = addSeats(room, 3);
    expect(added).toBe(3);
    expect(more.pieces).toHaveLength(room.pieces.length);
    expect(more.seats.slice(-3).every((seat) => onRug(seat, carpet))).toBe(true);
  });

  it('keeps a dragged spot on the rug', () => {
    const rug = (fixtures as unknown as LayoutLibrary).layouts.find((layout) => layout.category === 'carpets')!;
    const room = placeLayout(emptyDoc().room, rug, 1);
    const seat = room.seats[0];
    const moved = moveSpot(room, seat.id, 5000, 0);
    const after = moved.seats.find((s) => s.id === seat.id)!;
    expect(onRug(after, rugOf(moved)!)).toBe(true);
  });
});

describe('desk size', () => {
  it('keeps the manager’s moves and added desks when the size changes', () => {
    const placed = placeLayout(emptyDoc().room, traditional, 1);
    const changed = addSeats(moveSelection(placed, ['L-f1'], 40, 0), 1).room;
    const smaller = scaleLayout(changed, 0.65);
    expect(smaller.layout?.size).toBe(0.65);
    expect(smaller.seats).toHaveLength(changed.seats.length);
    expect(smaller.pieces.find((piece) => piece.id === 'L-f1')!.w).toBeCloseTo(changed.pieces.find((piece) => piece.id === 'L-f1')!.w * 0.65);
  });

  it('keeps every table inside the walls when it grows', () => {
    const room = setRoomFeet(emptyDoc(), { width: 20, depth: 16 }).room;
    const placed = placeLayout(room, traditional, fittedSize(room, traditional));
    const bigger = scaleLayout(placed, 1.15);
    const box = bigger.pieces.map((piece) => piece.x);
    expect(Math.min(...box)).toBeGreaterThan(0);
    expect(Math.max(...box)).toBeLessThan(bigger.width);
  });
});

describe('keeping the manager’s changes when switching layouts', () => {
  const pods = layouts.find((layout) => layout.name === 'Pods of 4')!;

  it('empties the room when the manager switches to another kind of seating', () => {
    const room = setLayoutAside(placeLayout(emptyDoc().room, traditional, 1), traditional);
    expect(room.layout).toBeNull();
    expect(room.seats).toEqual([]);
    expect(room.savedLayouts).toEqual({});
  });

  it('brings back the manager’s version of a changed layout', () => {
    const moved = moveSelection(placeLayout(emptyDoc().room, traditional, 1), ['L-f1'], 40, 0);
    expect(isLayoutChanged(moved, traditional)).toBe(true);
    const switched = chooseLayout(moved, pods, traditional);
    expect(Object.keys(switched.savedLayouts!)).toEqual(['desks-traditional']);
    const back = chooseLayout(switched, traditional, pods);
    expect(back.pieces.find((piece) => piece.id === 'L-f1')!.x).toBe(moved.pieces.find((piece) => piece.id === 'L-f1')!.x);
    expect(back.savedLayouts).toEqual({});
  });

  it('does not save a layout the manager never changed', () => {
    const switched = chooseLayout(placeLayout(emptyDoc().room, traditional, 1), pods, traditional);
    expect(switched.savedLayouts).toEqual({});
  });
});

describe('walls', () => {
  it('counts a table that only touches a wall as inside', () => {
    const placed = placeLayout(emptyDoc().room, traditional, 1);
    const desk = placed.pieces.find((piece) => piece.id === 'L-f1')!;
    const half = Math.max(...pieceOutline(desk).map((p) => p.y)) - desk.y;
    const touching = { ...placed, pieces: placed.pieces.map((piece) => (piece.id === 'L-f1' ? { ...piece, y: placed.depth - half } : piece)) };
    expect(piecesOutsideWalls(touching)).not.toContain('L-f1');
  });
});

describe('a layout left as placed', () => {
  it('still counts as unchanged after the room is resized', () => {
    const doc = emptyDoc();
    const layout = (library as LayoutLibrary).layouts.find((candidate) => candidate.id === 'desks-traditional')!;
    const placed = placeLayout(doc.room, layout, fittedSize(doc.room, layout));
    const wider = resizedRoom(placed, { width: toFeet(placed.width) + 4, fromLeft: true });
    expect(isLayoutChanged(wider, layout)).toBe(false);
  });
});
