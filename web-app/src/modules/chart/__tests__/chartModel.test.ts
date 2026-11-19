import { describe, expect, it } from 'vitest';

import { DEFAULT_DIRECTIONS, deleteChart, directionsOf, restoreChart, saveChart, sheetSeats, shownDirections } from '@modules/chart/chartModel';
import type { ClassroomDocument } from '@modules/classroom/document';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { placeLayout } from '@modules/room/layoutPlacement';
import { currentAssignment, engineRoom, placeAll } from '@modules/seats/seatingModel';
import { docWith, student } from '@test/classroomDocs';

const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;

function seatedClass(): ClassroomDocument {
  const doc = docWith(Array.from({ length: 10 }, (_, i) => student(`s${i}`, `Person ${i}`, 3)));
  const withRoom = { ...doc, room: placeLayout(doc.room, traditional, 1) };
  return placeAll(withRoom, engineRoom(withRoom.room));
}

describe('directions', () => {
  it('starts with the starting directions and keeps one step per line', () => {
    const doc = seatedClass();
    expect(directionsOf(doc.chart)).toEqual(DEFAULT_DIRECTIONS);
    const edited = { ...doc.chart, directions: ['Stand up', '  ', 'Push in your chair'] };
    expect(shownDirections(edited)).toEqual(['Stand up', 'Push in your chair']);
    expect(shownDirections({ ...doc.chart, directions: [''] })).toEqual(DEFAULT_DIRECTIONS);
  });
});

describe('past charts', () => {
  it('saves who sits where, newest first, and restores it in the same layout', () => {
    const doc = seatedClass();
    const saved = saveChart(doc, new Date('2026-10-19T12:00:00Z'));
    expect(saved.savedCharts).toHaveLength(1);
    expect(saved.savedCharts[0]).toMatchObject({ layoutId: 'desks-traditional' });
    expect(saved.savedCharts[0].name).toMatch(/^Oct 1[89], 2026, /);
    const moved = { ...saved, seating: { ...saved.seating, assignment: {} } };
    expect(currentAssignment(restoreChart(moved, saved.savedCharts[0].id))).toEqual(currentAssignment(doc));
  });

  it('doesn’t restore a chart from another layout, and deletes charts', () => {
    const saved = saveChart(seatedClass());
    const other = { ...saved, room: { ...saved.room, layout: { id: 'other', size: 1 } } };
    expect(restoreChart(other, saved.savedCharts[0].id)).toBe(other);
    expect(deleteChart(saved, saved.savedCharts[0].id).savedCharts).toEqual([]);
  });
});

describe('saving charts', () => {
  it('doesn’t save the same seats twice, and keeps the newest 30', () => {
    const doc = seatedClass();
    const once = saveChart(doc, new Date('2026-10-19T12:00:00Z'));
    expect(saveChart(once, new Date('2026-10-19T12:05:00Z'))).toBe(once);
    // A chart brought back and saved again isn't a new one either.
    const [seatA, seatB] = Object.keys(doc.seating.assignment);
    const swapped = { ...once, seating: { ...once.seating, assignment: { ...once.seating.assignment, [seatA]: once.seating.assignment[seatB], [seatB]: once.seating.assignment[seatA] } } };
    const twice = saveChart(swapped, new Date('2026-10-19T12:10:00Z'));
    expect(saveChart({ ...twice, seating: once.seating }, new Date('2026-10-19T12:15:00Z'))).toEqual({ ...twice, seating: once.seating });
    let many = doc;
    const seats = Object.keys(doc.seating.assignment);
    const students = seats.map((seat) => doc.seating.assignment[seat]);
    for (let i = 0; i < 31; i++) {
      // A different order of the first five students each time (5! = 120 orders).
      const order = [...students.slice(0, 5)];
      let n = i;
      const shuffled: string[] = [];
      for (let left = order.length; left > 0; left--) {
        shuffled.push(order.splice(n % left, 1)[0]);
        n = Math.floor(n / left);
      }
      const assignment = Object.fromEntries(seats.map((seat, index) => [seat, index < 5 ? shuffled[index] : students[index]]));
      many = saveChart({ ...many, seating: { ...many.seating, assignment } }, new Date(Date.UTC(2026, 9, 1, 0, i)));
    }
    expect(many.savedCharts).toHaveLength(30);
    expect(many.savedCharts[0].savedAt > many.savedCharts[29].savedAt).toBe(true);
  });

  it('keeps a lock when the teammate goes back to the same seat, and ignores a chart with no seats left', () => {
    const doc = seatedClass();
    const [seat] = Object.keys(doc.seating.assignment);
    const saved = saveChart({ ...doc, seating: { ...doc.seating, lockedSeats: [seat] } });
    expect(restoreChart(saved, saved.savedCharts[0].id).seating.lockedSeats).toEqual([seat]);
    const noSeats = { ...saved, room: { ...saved.room, seats: [] } };
    expect(restoreChart(noSeats, saved.savedCharts[0].id)).toBe(noSeats);
  });

});

describe('the chart’s seats', () => {
  it('shows a color tag only when colors are on and the tag is still in use', () => {
    const doc = seatedClass();
    const tagged = { ...doc, students: doc.students.map((s) => ({ ...s, color: 0 })) };
    expect(sheetSeats(tagged).every((seat) => seat.color === null)).toBe(true);
    const on = { ...tagged, colors: { ...tagged.colors, enabled: true } };
    expect(sheetSeats(on).every((seat) => seat.color === 0)).toBe(true);
    const retired = { ...on, colors: { ...on.colors, tags: on.colors.tags.map((tag, i) => (i === 0 ? { ...tag, inUse: false } : tag)) } };
    expect(sheetSeats(retired).every((seat) => seat.color === null)).toBe(true);
  });
});
