import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { Layout } from '@modules/layouts/types';

import { buildRoom, labelCounts, suggestSeatLabels } from '..';
import { doors, layout, students, teacherSpots } from './workedExample';

const room = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots, doors });
const count = (labels: Record<string, number>, level: number) => Object.values(labels).filter((l) => l === level).length;

describe('seat labels', () => {
  const labels = suggestSeatLabels(room, labelCounts(room, students));

  it("matches the worked example's totals: 8 ones, 6 twos, 10 threes", () => {
    expect([count(labels, 1), count(labels, 2), count(labels, 3)]).toEqual([8, 6, 10]);
  });

  it('never puts two 1 seats next to each other', () => {
    room.seats.forEach((seat) => {
      if (labels[seat.id] !== 1) return;
      expect(room.neighbors[seat.index].filter((n) => labels[room.seats[n].id] === 1)).toEqual([]);
    });
  });

  it('puts the 1 seats closest to the manager', () => {
    const ones = room.seats.filter((s) => labels[s.id] === 1);
    const threes = room.seats.filter((s) => labels[s.id] === 3);
    const average = (list: typeof ones) => list.reduce((sum, s) => sum + s.closeness, 0) / list.length;
    expect(average(ones)).toBeGreaterThan(average(threes));
  });

  it('keeps the labels the manager set by hand', () => {
    const handSet = { s24: 1 as const, s1: 3 as const };
    const relabeled = suggestSeatLabels(room, labelCounts(room, students), handSet);
    expect(relabeled.s24).toBe(1);
    expect(relabeled.s1).toBe(3);
    expect(count(relabeled, 1)).toBe(8);
  });

  it('makes a spare 1 seat and a share of seats without a roster', () => {
    expect(labelCounts(room, students)[1]).toBe(8);
    expect(labelCounts(room)).toEqual({ 1: 5, 2: 6, 3: 13 });
  });

  it('keeps each pod of 5 to two 1 seats', () => {
    const pods = (library.layouts as Layout[]).find((l) => l.id === 'desks-pods-of-5')!;
    const podRoom = buildRoom({ seats: pods.seats, furniture: pods.furniture, teacherSpots: [] });
    const podLabels = suggestSeatLabels(podRoom, { 1: 8, 2: 6, 3: 11 });
    for (const group of podRoom.groups) {
      expect(group.filter((i) => podLabels[podRoom.seats[i].id] === 1).length).toBeLessThanOrEqual(2);
    }
  });
});
