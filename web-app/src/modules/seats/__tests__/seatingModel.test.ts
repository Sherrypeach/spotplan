import { describe, expect, it } from 'vitest';

import type { ClassroomDocument } from '@modules/classroom/document';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { placeLayout } from '@modules/room/layoutPlacement';
import {
  checkInput,
  checks,
  currentAssignment,
  engineRoom,
  feedbackOf,
  fits,
  moveStudent,
  placeAll,
  resetLabels,
  seatLabels,
  setLabel,
  shuffleAll,
  toggleCheckedOff,
  toggleLock,
  unseat,
} from '@modules/seats/seatingModel';
import { docWith, student } from '@test/classroomDocs';

const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;

function roomOf() {
  return engineRoom(classOf(20).room);
}

function classOf(count: number): ClassroomDocument {
  const levels = [1, 2, 3, 3, 2] as const;
  const doc = docWith(Array.from({ length: count }, (_, i) => student(`s${i}`, `Person ${i}`, levels[i % levels.length])));
  return { ...doc, room: placeLayout(doc.room, traditional, 1) };
}

describe('seat labels', () => {
  it('suggests a label for every seat, with a spare 1 seat', () => {
    const doc = classOf(20);
    const labels = seatLabels(doc, engineRoom(doc.room));
    expect(Object.keys(labels)).toHaveLength(doc.room.seats.length);
    const ones = Object.values(labels).filter((label) => label === 1).length;
    expect(ones).toBeGreaterThan(doc.students.filter((s) => s.level === 1).length);
  });

  it('keeps a label set by hand, and goes back to the suggestions on reset', () => {
    const doc = classOf(20);
    const seat = doc.room.seats[0].id;
    const room = engineRoom(doc.room);
    const before = seatLabels(doc, room)[seat];
    const other = before === 3 ? 1 : 3;
    const changed = setLabel(doc, seat, other);
    expect(seatLabels(changed, room)[seat]).toBe(other);
    expect(seatLabels(resetLabels(changed), room)[seat]).toBe(before);
  });
});

describe('seating the team', () => {
  it('seats everyone when there are enough seats', () => {
    const seated = placeAll(classOf(20), roomOf());
    expect(Object.keys(currentAssignment(seated))).toHaveLength(20);
    expect(checks(seated, engineRoom(seated.room)).some((item) => item.kind === 'unseated')).toBe(false);
  });

  it('keeps locked teammates in their seat when shuffling', () => {
    const seated = placeAll(classOf(20), roomOf());
    const [seat, kid] = Object.entries(currentAssignment(seated))[0];
    const shuffled = shuffleAll(toggleLock(seated, seat), engineRoom(seated.room), 7);
    expect(currentAssignment(shuffled)[seat]).toBe(kid);
  });

  it('swaps two teammates when one is dropped on the other', () => {
    const seated = placeAll(classOf(20), roomOf());
    const [[seatA, a], [seatB, b]] = Object.entries(currentAssignment(seated));
    const swapped = currentAssignment(moveStudent(seated, a, seatB));
    expect(swapped[seatB]).toBe(a);
    expect(swapped[seatA]).toBe(b);
  });

  it('unseats a teammate', () => {
    const seated = placeAll(classOf(20), roomOf());
    const after = unseat(seated, 's0');
    expect(Object.values(currentAssignment(after))).not.toContain('s0');
  });
});

describe('fits', () => {
  it('lets 3s sit anywhere and 2s take a spare 1 seat', () => {
    expect(fits(3, 1)).toBe(true);
    expect(fits(2, 1)).toBe(true);
    expect(fits(1, 2)).toBe(false);
    expect(fits(2, 3)).toBe(false);
  });
});

describe('checked-off items', () => {
  it('keys team-wide items without names, so keys stay short for a big team', () => {
    const doc = classOf(30);
    const allWantFront = { ...doc, students: doc.students.map((s) => ({ ...s, needs: { 'face-front': 'nice' as const } })) };
    const room = engineRoom(allWantFront.room);
    for (const item of checks(placeAll(allWantFront, room), room)) expect(item.key.length).toBeLessThanOrEqual(300);
  });

  it('keeps only items still on the list', () => {
    const doc = { ...classOf(20), seating: { assignment: {}, lockedSeats: [], checkedOff: ['old|gone||'] } };
    const room = engineRoom(doc.room);
    const key = checks(doc, room)[0].key;
    expect(toggleCheckedOff(doc, room, key).seating.checkedOff).toEqual([key]);
  });
});

describe('settings', () => {
  it('reads missing or odd feedback values as off', () => {
    const doc = classOf(4);
    expect(feedbackOf({ ...doc, settings: { ...doc.settings, feedback: {} } })).toEqual({ spreadOutOnes: 0, onesCloserToMe: 0, fewerOnesPerTable: 0 });
    expect(feedbackOf({ ...doc, settings: { ...doc.settings, feedback: { spreadOutOnes: 7 } } }).spreadOutOnes).toBe(2);
  });
});

describe('checkInput', () => {
  it('only passes colors from tags that are switched on', () => {
    const base = docWith([student('a', 'Ava', 1), student('b', 'Ben', 2)]);
    base.students[0].color = 0;
    base.students[1].color = 1;
    const tags = base.colors.tags.map((tag, index) => ({ ...tag, inUse: index === 0 }));
    const doc = { ...base, colors: { enabled: true, tags } };
    const room = engineRoom(doc.room);
    expect(checkInput(doc, room).students.map((s) => s.color)).toEqual([0, null]);
    expect(checkInput({ ...doc, colors: { ...doc.colors, enabled: false } }, room).students.map((s) => s.color)).toEqual([null, null]);
  });
});
