import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { Layout } from '@modules/layouts/types';

import { buildRoom, labelCounts, placeStudents, suggestSeatLabels } from '..';
import type { Level, Student } from '..';

const layouts = (library.layouts as Layout[]).filter((l) => l.seats.length > 0);

// A class that fits the layout: about a third 1s, a quarter 2s, the rest 3s.
function classFor(seatCount: number): Student[] {
  const size = Math.min(seatCount, 30);
  return Array.from({ length: size }, (_, i) => {
    const level: Level = i < size * 0.3 ? 1 : i < size * 0.55 ? 2 : 3;
    return { id: `st${i}`, name: `Teammate ${i}`, level, color: i % 2, needs: {} };
  });
}

describe('every layout in the library', () => {
  it.each(layouts.map((l) => [l.id, l] as const))('%s labels and seats a team', (_, layout) => {
    const room = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots: [] });
    const students = classFor(room.seats.length);
    const labels = suggestSeatLabels(room, labelCounts(room, students));
    expect(Object.keys(labels)).toHaveLength(room.seats.length);

    const result = placeStudents({ room, students, labels }, { moves: 3000, runs: 1 });
    expect(result.unseated).toEqual([]);
    expect(new Set(Object.values(result.assignment)).size).toBe(students.length);
  });
});
