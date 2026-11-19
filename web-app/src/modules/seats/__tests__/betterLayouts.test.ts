import { describe, expect, it } from 'vitest';

import { EXAMPLE_LAYOUT_ID, exampleClass } from '@modules/classroom/exampleClass';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { scaleLayout } from '@modules/room/layoutPlacement';
import { compareLayouts, frontFacingLayouts, switchLayout } from '@modules/seats/betterLayouts';
import { emptyDoc } from '@test/classroomDocs';

const layouts = (library as LayoutLibrary).layouts;
const example = layouts.find((candidate) => candidate.id === EXAMPLE_LAYOUT_ID)!;

describe('finding layouts that fit the team better', () => {
  it('scores the worked example and keeps any suggestions to a short list', () => {
    const doc = exampleClass(emptyDoc(), example);
    const { now, better } = compareLayouts(doc, layouts);
    expect(now?.layout.id).toBe(EXAMPLE_LAYOUT_ID);
    expect(better.length).toBeLessThanOrEqual(3);
  });

  it('suggests only layouts that beat a poor fit by more than 1.5 points, best first', () => {
    const doc = exampleClass(emptyDoc(), example);
    // Squeezed to the smallest size, the current layout loses points for shrinking.
    const squeezed = { ...doc, room: scaleLayout(doc.room, 0.45) };
    const { now, better } = compareLayouts(squeezed, layouts);
    expect(better.length).toBeGreaterThan(0);
    expect(better.length).toBeLessThanOrEqual(3);
    for (const [index, { fit, better: gains }] of better.entries()) {
      expect(fit.layout.category).not.toBe('carpets');
      expect(fit.score).toBeGreaterThan(now!.score + 1.5);
      if (index > 0) expect(fit.score).toBeLessThanOrEqual(better[index - 1].fit.score);
      expect(gains.length).toBeGreaterThan(0);
    }
  });

  it('switching puts the new layout in the room, empties the seats and keeps a locked room locked', () => {
    const doc = exampleClass(emptyDoc(), example);
    const seated = { ...doc, room: { ...doc.room, locked: true }, seating: { ...doc.seating, assignment: { 'L-s1': 'ex1' }, lockedSeats: ['L-s1'] } };
    const other = layouts.find((layout) => layout.category !== 'carpets' && layout.id !== EXAMPLE_LAYOUT_ID && layout.seats.length >= 24)!;
    const switched = switchLayout(seated, other, example);
    expect(switched.room.layout?.id).toBe(other.id);
    expect(switched.room.locked).toBe(true);
    expect(switched.seating.assignment).toEqual({});
    expect(switched.seating.lockedSeats).toEqual([]);
  });

  it('lists layouts where every seat faces the front and the whole team fits', () => {
    const doc = exampleClass(emptyDoc(), example);
    const { better } = frontFacingLayouts(doc, layouts);
    expect(better.length).toBeGreaterThan(0);
    for (const { fit } of better) {
      expect(fit.facingFront).toBe(fit.seats);
      expect(fit.seats).toBeGreaterThanOrEqual(doc.students.length);
    }
  });
});
