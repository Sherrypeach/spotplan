import { describe, expect, it } from 'vitest';

import { wrapText } from '@modules/chart/sheetLayout';
import { nameShapes, placeNames, tagSize, type NameSeat } from '@modules/chart/sheetNames';

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 };

function seat(id: string, name: string, x: number, y: number, room: number, table = id): NameSeat {
  return { id, name, color: null, table, chair: { x, y: y + 40 }, onDesk: { x, y, room }, along: null, away: { x: 0, y: 1 }, reach: 15 };
}

describe('placing names', () => {
  it('puts a name on its desk when there is room', () => {
    const plan = placeNames([seat('a', 'Ava', 500, 500, 200)], [], BOUNDS, [20, 16]);
    expect(plan.font).toBe(20);
    expect(plan.tags[0]).toMatchObject({ x: 500, y: 500, beside: false, lines: ['Ava'] });
  });

  it('moves every name of a table beside its chair when one of them can’t stay on the table', () => {
    // The desk next door leaves the second name no room on the table.
    const seats = [seat('a', 'Ava', 500, 500, 80, 't'), seat('b', 'Maximilian Robinson', 600, 500, 80, 't')];
    const plan = placeNames(seats, [{ box: { left: 560, right: 640, top: 470, bottom: 530 }, table: 'other' }], BOUNDS, [20]);
    expect(plan.tags.every((tag) => tag.beside)).toBe(true);
  });

  it('keeps names off each other at one size for all', () => {
    const seats = Array.from({ length: 6 }, (_, i) => seat(`s${i}`, 'Charlotte Anderson', 100 + i * 60, 500, 60));
    const plan = placeNames(seats, [], BOUNDS, [22, 18, 14]);
    for (const [i, a] of plan.tags.entries())
      for (const b of plan.tags.slice(i + 1)) expect(Math.abs(a.x - b.x) * 2 >= a.width + b.width || Math.abs(a.y - b.y) * 2 >= a.height + b.height).toBe(true);
  });

  it('splits a long name in two where the halves come out most even', () => {
    expect(nameShapes('Anna-Sofia Delacroix')[1]).toEqual(['Anna-Sofia', 'Delacroix']);
    expect(nameShapes('Ava')).toEqual([['Ava']]);
  });

  it('makes room for a color dot', () => {
    expect(tagSize(['Ava'], 1, 20).width).toBeGreaterThan(tagSize(['Ava'], null, 20).width);
  });
});

describe('wrapping text', () => {
  it('keeps every word, breaking only a word too long for a line', () => {
    const text = 'Slowly and carefully slide your desk to your new spot.';
    expect(wrapText(text, 200, 19).join(' ')).toBe(text);
    expect(wrapText('Supercalifragilistic', 80, 19).join('')).toBe('Supercalifragilistic');
  });
});
