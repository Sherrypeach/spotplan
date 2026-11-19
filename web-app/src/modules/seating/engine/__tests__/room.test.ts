import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { Furniture, Layout, Seat } from '@modules/layouts/types';

import { buildRoom } from '..';
import type { Room } from '..';
import { furnitureOutline } from '../geometry';

const layouts = library.layouts as Layout[];
const roomFor = (id: string, extra = {}) => {
  const layout = layouts.find((l) => l.id === id)!;
  return buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots: [], ...extra });
};
const idsNextTo = (room: Room, seatId: string) =>
  room.neighbors[room.seatIndex.get(seatId)!].map((i) => room.seats[i].id).sort();

describe('who counts as next to', () => {
  // A pod of 5: s1/s2 face each other, s7/s8 face each other below them, and
  // s13 is the end desk turned to face the front.
  const pods = roomFor('desks-pods-of-5');

  it('counts desks face to face and side by side', () => {
    expect(idsNextTo(pods, 's1')).toEqual(['s2', 's7']);
  });

  it("doesn't count diagonal desks or the end desk at a right angle", () => {
    expect(idsNextTo(pods, 's1')).not.toContain('s8');
    expect(idsNextTo(pods, 's13')).not.toContain('s7');
    expect(idsNextTo(pods, 's13')).not.toContain('s8');
  });

  it('counts chairs that sit close even without touching desks', () => {
    const one: Furniture = { id: 'A', kind: 'desk', x: 0, y: 0, w: 1, h: 0.685, rotation: 180, flipH: false };
    const two: Furniture = { ...one, id: 'B', x: 1.1 };
    const seats: Seat[] = [
      { id: 'a', furnitureId: 'A', x: 0, y: 0.4, facing: 0 },
      { id: 'b', furnitureId: 'B', x: 1.1, y: 0.4, facing: 0 },
    ];
    const room = buildRoom({ seats, furniture: [one, two], teacherSpots: [] });
    expect(idsNextTo(room, 'a')).toEqual(['b']);
  });

  it('is symmetric on every layout', () => {
    for (const layout of layouts) {
      const room = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots: [] });
      room.neighbors.forEach((list, a) => list.forEach((b) => expect(room.neighbors[b]).toContain(a)));
    }
  });
});

describe('groups', () => {
  it('makes a group of each pod of touching desks', () => {
    expect(roomFor('desks-pods-of-5').groups.map((g) => g.length)).toEqual([5, 5, 5, 5, 5]);
  });

  it('only counts groups of 3 to 10 seats', () => {
    for (const layout of layouts) {
      const room = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots: [] });
      expect(room.groups.every((g) => g.length >= 3 && g.length <= 10)).toBe(true);
    }
  });
});

describe('closeness to the manager', () => {
  it('scores seats in the green zone highest and fades with distance', () => {
    const room = roomFor('desks-rows');
    // Without marked spots, the teacher is at the middle of the front wall.
    const middleX = (Math.min(...room.seats.map((s) => s.x)) + Math.max(...room.seats.map((s) => s.x))) / 2;
    const frontRowY = Math.min(...room.seats.map((s) => s.y));
    const front = room.seats
      .filter((s) => s.y - frontRowY < 0.3)
      .reduce((a, b) => (Math.abs(b.x - middleX) < Math.abs(a.x - middleX) ? b : a));
    const back = room.seats.reduce((a, b) => (b.y > a.y ? b : a));
    expect(front.zone).toBe('green');
    expect(front.closeness).toBeGreaterThan(back.closeness);
  });

  it('ignores spots marked "not much"', () => {
    const layout = layouts.find((l) => l.id === 'desks-rows')!;
    const left = { id: 'l', x: 0, y: 3.5 };
    const right = { id: 'r', x: 10.7, y: 3.5 };
    const room = buildRoom({
      seats: layout.seats,
      furniture: layout.furniture,
      teacherSpots: [
        { ...left, time: 'most' },
        { ...right, time: 'not-much' },
      ],
    });
    const leftmost = room.seats.reduce((a, b) => (b.x < a.x ? b : a));
    const rightmost = room.seats.reduce((a, b) => (b.x > a.x ? b : a));
    expect(leftmost.closeness).toBeGreaterThan(rightmost.closeness);
    expect(rightmost.zone).toBe('red');
  });

  it('weighs a "most" spot above a "sometimes" spot', () => {
    const layout = layouts.find((l) => l.id === 'desks-rows')!;
    const room = buildRoom({
      seats: layout.seats,
      furniture: layout.furniture,
      teacherSpots: [
        { id: 'l', time: 'most', x: 0, y: 3.5 },
        { id: 'r', time: 'sometimes', x: 10.7, y: 3.5 },
      ],
    });
    const leftmost = room.seats.reduce((a, b) => (b.x < a.x ? b : a));
    const rightmost = room.seats.reduce((a, b) => (b.x > a.x ? b : a));
    expect(leftmost.closeness).toBeGreaterThan(rightmost.closeness);
  });

  it('measures to the nearest edge of a piece of furniture', () => {
    const table = { id: 't', time: 'most' as const, x: 5, y: 5, outline: [
      { x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 },
    ] };
    const seat: Seat = { id: 's', furnitureId: 'none', x: 6.5, y: 5, facing: 0 };
    const room = buildRoom({ seats: [seat], furniture: [], teacherSpots: [table] });
    expect(room.seats[0].desksFromTeacher).toBeCloseTo(0.5);
  });

  it('has no door ranking until a door is drawn', () => {
    expect(roomFor('desks-rows').doorRank).toBeNull();
    const withDoor = roomFor('desks-rows', { doors: [{ a: { x: 0, y: 7 }, b: { x: 1, y: 7 } }] });
    expect(withDoor.doorRank).not.toBeNull();
  });

  it('rejects seats without a valid position', () => {
    const layout = layouts.find((l) => l.id === 'desks-rows')!;
    const broken = [{ ...layout.seats[0], x: Number.NaN }, ...layout.seats.slice(1)];
    expect(() => buildRoom({ seats: broken, furniture: layout.furniture, teacherSpots: [] })).toThrow(/invalid position/);
  });
});

describe('furniture outline', () => {
  it('mirrors a piece horizontally before rotating it', () => {
    const triangle: Furniture = { id: 't', kind: 'triangle-table', x: 0, y: 0, w: 1, h: 1, rotation: 0, flipH: false };
    const plain = furnitureOutline(triangle);
    furnitureOutline({ ...triangle, flipH: true }).forEach((p, i) => expect(p.x).toBeCloseTo(-plain[i].x));
  });
});
