import { describe, expect, it } from 'vitest';

import { buildRoom } from '..';
import { Scorer } from '../scoring';
import { seededRandom } from '../search';
import { doors, guideChart, guideLabels, keepJimAndKellyApart, layout, students, teacherSpots } from './workedExample';

// Three seats short of the class, so some swaps are moves into empty seats.
const seats = layout.seats.slice(0, 21);
const room = buildRoom({ seats, furniture: layout.furniture, teacherSpots, doors });

describe('scoring', () => {
  it('computes the change from a swap exactly as rescoring the whole room would', () => {
    const scorer = new Scorer(room, {
      room,
      students,
      labels: guideLabels,
      keepApart: keepJimAndKellyApart,
      current: guideChart,
      saved: [guideChart],
      feedback: { spreadOutOnes: 2, onesCloserToMe: 1, fewerOnesPerTable: 1 },
      balanceColors: true,
    });
    const random = seededRandom(3);
    for (let s = 0; s < 21; s++) scorer.place(s, s);
    for (let i = 0; i < 400; i++) {
      const a = Math.floor(random() * scorer.seatCount);
      const b = Math.floor(random() * scorer.seatCount);
      if (a === b) continue;
      const before = scorer.total();
      const delta = scorer.swapDelta(a, b);
      scorer.swap(a, b);
      expect(scorer.total() - before).toBeCloseTo(delta, 6);
    }
  });

  it('costs a 1 in a 3 seat more than a 1 in a 2 seat', () => {
    const scorer = new Scorer(room, { room, students, labels: { ...guideLabels, s1: 3, s3: 2 } });
    const kelly = students.findIndex((s) => s.id === 'Nora');
    expect(scorer.placeDelta(kelly, 0)).toBeGreaterThan(scorer.placeDelta(kelly, 2));
  });
});
