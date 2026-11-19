import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { piecesOutsideWalls, piecesOverlapping, placeLayout } from '@modules/room/layoutPlacement';
import { setRoomShape } from '@modules/room/roomEdits';
import {
  clampMove,
  copySelection,
  moveSelection,
  piecesInBox,
  pieceGroups,
  removeSelection,
  selectionAfterClick,
  selectionBounds,
  splitSelection,
  turnSelection,
} from '@modules/room/selection';
import { emptyDoc } from '@test/classroomDocs';

const layouts = (library as LayoutLibrary).layouts;
const pods = placeLayout(emptyDoc().room, layouts.find((layout) => layout.name === 'Pods of 4')!, 1);
const rows = placeLayout(emptyDoc().room, layouts.find((layout) => layout.id === 'desks-traditional')!, 1);

describe('picking up desks', () => {
  it('picks up a whole pod with one click, and puts it down with a second', () => {
    const first = selectionAfterClick(pods, [], 'L-f1');
    expect(first.length).toBe(4);
    expect(selectionAfterClick(pods, first, 'L-f1')).toEqual([]);
  });

  it('treats a desk standing alone as its own group', () => {
    expect(pieceGroups(rows).get('L-f1')).toEqual(['L-f1']);
  });

  it('moves the pieces and their seats together, but never through a wall', () => {
    const ids = pieceGroups(pods).get('L-f1')!;
    const moved = moveSelection(pods, ids, 30, 0);
    const before = pods.seats.filter((seat) => ids.includes(seat.furnitureId));
    const after = moved.seats.filter((seat) => ids.includes(seat.furnitureId));
    expect(after.map((seat) => seat.x - 30)).toEqual(before.map((seat) => seat.x));
    const box = selectionBounds(pods, ids)!;
    expect(clampMove(pods, ids, -10_000, 0).dx).toBeCloseTo(-box.left);
  });

  it('turns a pod a quarter turn, seats and all', () => {
    const ids = pieceGroups(pods).get('L-f1')!;
    const turned = turnSelection(pods, ids);
    const piece = turned.pieces.find((p) => p.id === 'L-f1')!;
    expect(piece.rotation).toBe((pods.pieces.find((p) => p.id === 'L-f1')!.rotation + 90) % 360);
    const box = selectionBounds(turned, ids)!;
    expect(box.left).toBeGreaterThanOrEqual(0);
  });

  it('removes a pod and its seats, and copies one into open floor', () => {
    const ids = pieceGroups(pods).get('L-f1')!;
    const fewer = removeSelection(pods, ids);
    expect(fewer.seats.length).toBe(pods.seats.length - 4);
    const { room, copied } = copySelection(fewer, pieceGroups(fewer).values().next().value!);
    expect(copied.length).toBe(4);
    expect(room.seats.length).toBe(pods.seats.length);
  });

  it('turns a pod to any angle, like 45 degrees', () => {
    const ids = pieceGroups(pods).get('L-f1')!;
    const turned = turnSelection(pods, ids, 45);
    const before = pods.pieces.find((p) => p.id === 'L-f1')!.rotation;
    expect(turned.pieces.find((p) => p.id === 'L-f1')!.rotation).toBe((before + 45) % 360);
  });

  it('keeps two pods apart even when they are pushed together, and flags the overlap', () => {
    const groups = [...new Set([...pieceGroups(pods).values()].map((group) => group.join()))].map((key) => key.split(','));
    const [first, second] = groups;
    const a = selectionBounds(pods, first)!;
    const b = selectionBounds(pods, second)!;
    const pushed = moveSelection(pods, second, a.left - b.left + 5, a.top - b.top + 5);
    expect(pieceGroups(pushed).get(first[0])).toEqual(first);
    expect(piecesOverlapping(pushed).length).toBeGreaterThan(0);
    expect(piecesOverlapping(pods)).toEqual([]);
  });
});

describe('splitting a table', () => {
  it('turns every piece into its own table, a little apart', () => {
    const ids = pieceGroups(pods).get('L-f1')!;
    const split = splitSelection(pods, ids);
    for (const id of ids) expect(pieceGroups(split).get(id)).toEqual([id]);
    const before = pods.pieces.find((piece) => piece.id === ids[0])!;
    const after = split.pieces.find((piece) => piece.id === ids[0])!;
    expect(after.x !== before.x || after.y !== before.y).toBe(true);
    expect(split.seats).toHaveLength(pods.seats.length);
  });
});

describe('splitting a row', () => {
  it('leaves every desk of a row apart from its neighbors', () => {
    const row = placeLayout(emptyDoc().room, layouts.find((layout) => layout.id === 'desks-traditional')!, 1);
    const ids = row.pieces.filter((piece) => Math.abs(piece.y - row.pieces[0].y) < 1).map((piece) => piece.id);
    const together = { ...row, pieces: row.pieces.map((piece) => (ids.includes(piece.id) ? { ...piece, group: 'g-row' } : piece)) };
    const split = splitSelection(together, ids);
    const xs = split.pieces.filter((piece) => ids.includes(piece.id)).map((piece) => piece.x).sort((a, b) => a - b);
    const before = together.pieces.filter((piece) => ids.includes(piece.id)).map((piece) => piece.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(before[i] - before[i - 1]);
  });
});

describe('L-shaped rooms', () => {
  it('never turns a table into the missing corner', () => {
    const doc = emptyDoc();
    const lRoom = setRoomShape(doc, 'l-shape').room;
    const placed = placeLayout(lRoom, layouts.find((layout) => layout.id === 'desks-traditional')!, 0.6);
    const ids = pieceGroups(placed).get(placed.pieces[0].id)!;
    for (const degrees of [45, 90, 135]) expect(piecesOutsideWalls(turnSelection(placed, ids, degrees))).toEqual(piecesOutsideWalls(placed));
  });
});

describe('picking tables with a box', () => {
  it('takes every table the box touches, whole, and nothing it misses', () => {
    const room = pods;
    const groups = pieceGroups(room);
    const first = room.pieces.find((piece) => groups.has(piece.id))!;
    const picked = piecesInBox(room, { left: first.x - 1, right: first.x + 1, top: first.y - 1, bottom: first.y + 1 });
    expect(picked.sort()).toEqual([...(groups.get(first.id) ?? [])].sort());
    expect(piecesInBox(room, { left: -50, right: -40, top: -50, bottom: -40 })).toEqual([]);
  });
});
