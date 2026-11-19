import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { Layout } from '@modules/layouts/types';

import {
  buildRoom,
  checkSeating,
  labelCounts,
  placeStudents,
  problemTotal,
  shuffleStudents,
  suggestSeatLabels,
  suggestSwaps,
} from '..';
import type { Assignment, Room, Student } from '..';
import { doors, guideChart, guideLabels, keepJimAndKellyApart, layout, students, teacherSpots } from './workedExample';

const room = buildRoom({ seats: layout.seats, furniture: layout.furniture, teacherSpots, doors });
const labels = suggestSeatLabels(room, labelCounts(room, students));
const input = { room, students, labels, keepApart: keepJimAndKellyApart, balanceColors: true };
const attention = (assignment: Assignment, extra = {}) =>
  checkSeating({ ...input, ...extra }, assignment).filter((i) => i.tier === 'attention');

const seatOf = (assignment: Assignment, id: string) => Object.keys(assignment).find((seat) => assignment[seat] === id)!;
function nextOrSameTable(r: Room, assignment: Assignment, a: string, b: string): boolean {
  const seatA = r.seatIndex.get(seatOf(assignment, a))!;
  const seatB = r.seatIndex.get(seatOf(assignment, b))!;
  const sameTable = r.groupOf[seatA] >= 0 && r.groupOf[seatA] === r.groupOf[seatB];
  return r.neighbors[seatA].includes(seatB) || sameTable;
}

describe('the worked example', () => {
  const placed = placeStudents(input);

  it('places the example team with nothing under "Needs attention"', () => {
    expect(placed.unseated).toEqual([]);
    expect(attention(placed.assignment)).toEqual([]);
  });

  it("finds nothing that needs attention in the worked example's own chart and labels", () => {
    expect(attention(guideChart, { labels: guideLabels })).toEqual([]);
  });

  it('gives the same seating for the same seed', () => {
    expect(placeStudents(input).assignment).toEqual(placed.assignment);
  });
});

describe('shuffling', () => {
  const shuffled = shuffleStudents({ ...input, current: guideChart }, { seed: 4 });

  it('moves most teammates to a new seat with new neighbors, keeping every rule', () => {
    const moved = Object.entries(shuffled.assignment).filter(([seat, id]) => guideChart[seat] !== id);
    expect(moved.length).toBeGreaterThanOrEqual(18);
    expect(attention(shuffled.assignment)).toEqual([]);
  });

  it('mostly changes which 3s sit next to 1s', () => {
    const byId = new Map(students.map((s) => [s.id, s]));
    const buffers = (assignment: Assignment) =>
      students
        .filter((s) => s.level === 3)
        .filter((s) =>
          room.neighbors[room.seatIndex.get(seatOf(assignment, s.id))!].some(
            (n) => byId.get(assignment[room.seats[n].id])?.level === 1,
          ),
        )
        .map((s) => s.id);
    const before = buffers(guideChart);
    const again = buffers(shuffled.assignment).filter((id) => before.includes(id));
    expect(again.length).toBeLessThan(before.length / 2);
  });

  it('keeps Jim and Kelly apart and off the same table', () => {
    for (const seed of [1, 2, 3]) {
      const result = shuffleStudents({ ...input, current: guideChart }, { seed });
      expect(nextOrSameTable(room, result.assignment, 'Eli', 'Nora')).toBe(false);
    }
  });

  it('comes out different each time', () => {
    const other = shuffleStudents({ ...input, current: guideChart }, { seed: 5 });
    expect(other.assignment).not.toEqual(shuffled.assignment);
  });

  it('keeps a locked teammate in the same seat through three shuffles', () => {
    let current = guideChart;
    for (const seed of [1, 2, 3]) {
      current = shuffleStudents({ ...input, current, locked: { s9: 'Emma' } }, { seed }).assignment;
      expect(current.s9).toBe('Emma');
    }
  });
});

describe('Must and Nice to have', () => {
  const pods = (library.layouts as Layout[]).find((l) => l.id === 'desks-pods-of-5')!;
  const podRoom = buildRoom({ seats: pods.seats, furniture: pods.furniture, teacherSpots: [] });
  const class25: Student[] = Array.from({ length: 25 }, (_, i) => ({
    id: `st${i}`,
    name: `Teammate ${i}`,
    level: (i < 6 ? 1 : i < 12 ? 2 : 3) as 1 | 2 | 3,
    color: null,
    needs: i % 3 === 0 && i < 27 ? { 'face-front': 'must' as const } : {},
  }));
  const podInput = { room: podRoom, students: class25, labels: suggestSeatLabels(podRoom, labelCounts(podRoom, class25)) };
  const result = placeStudents(podInput, { runs: 1 });
  const items = checkSeating(podInput, result.assignment);

  it('says when there are fewer front-facing seats than teammates who must face the front', () => {
    const short = items.find((i) => i.kind === 'too-few-front-seats');
    expect(short?.counts).toMatchObject({ have: 5, need: 9 });
  });

  it('says no single swap helps a teammate whose Must need the layout can’t meet', () => {
    const unmet = items.find((i) => i.kind === 'must-need-unmet' && i.need === 'face-front')!;
    expect(suggestSwaps(podInput, result.assignment, unmet)).toEqual([]);
  });

  it('lists unmet Nice-to-haves only in their own tier', () => {
    const nice = class25.map((s, i) => (i === 24 ? { ...s, needs: { 'near-door': 'nice' as const } } : s));
    const withDoor = buildRoom({
      seats: pods.seats,
      furniture: pods.furniture,
      teacherSpots: [],
      doors: [{ a: { x: 0, y: 0.5 }, b: { x: 0, y: 1.5 } }],
    });
    const far = withDoor.seats.reduce((a, b) => (withDoor.doorRank![b.index] > withDoor.doorRank![a.index] ? b : a));
    const found = checkSeating({ room: withDoor, students: nice, labels: podInput.labels }, { [far.id]: 'st24' });
    const doorItems = found.filter((i) => i.need === 'near-door');
    expect(doorItems.map((i) => i.tier)).toEqual(['nice']);
  });
});

describe('swap suggestions', () => {
  it('only suggests swaps that lower the problem total and add nothing that needs attention', () => {
    // Put Mateo (must sit near the front) in the back row.
    const chart = { ...guideChart, s4: 'Liam', s20: 'Mateo' };
    const items = checkSeating(input, chart);
    const problem = items.find((i) => i.kind === 'must-need-unmet' && i.studentIds.includes('Mateo'))!;
    const suggestions = suggestSwaps(input, chart, problem);
    expect(suggestions.length).toBeGreaterThan(0);
    const before = problemTotal(room, items);
    for (const s of suggestions) {
      expect(s.total).toBeLessThan(before);
      expect(s.newProblems.filter((p) => p.tier === 'attention')).toEqual([]);
    }
  });

  it('ties a checked-off item to its teammates and seats', () => {
    const chart = { ...guideChart, s4: 'Liam', s20: 'Mateo' };
    const [item] = checkSeating(input, chart).filter((i) => i.studentIds.includes('Mateo'));
    const moved = { ...chart, s20: 'Mia', s14: 'Mateo' };
    const again = checkSeating(input, moved).filter((i) => i.studentIds.includes('Mateo'));
    expect(again.map((i) => i.key)).not.toContain(item.key);
  });
});

describe('the pod rule', () => {
  const pods = (library.layouts as Layout[]).find((l) => l.id === 'desks-pods-of-5')!;
  const podRoom = buildRoom({ seats: pods.seats, furniture: pods.furniture, teacherSpots: [] });
  const ones: Student[] = ['a', 'b', 'c'].map((id) => ({ id, name: id, level: 1, color: null, needs: {} }));
  const allOnes = Object.fromEntries(podRoom.seats.map((s) => [s.id, 1 as const]));
  const bothOnes = (chart: Assignment) =>
    checkSeating({ room: podRoom, students: ones, labels: allOnes }, chart).filter((i) => i.kind === 'ones-side-by-side');

  it('allows 1s at the top-left desk, the bottom-right desk and the end desk', () => {
    expect(bothOnes({ s1: 'a', s8: 'b', s13: 'c' })).toEqual([]);
  });

  it('warns when two 1s sit face to face or side by side', () => {
    expect(bothOnes({ s1: 'a', s2: 'b' })).toHaveLength(1);
    expect(bothOnes({ s1: 'a', s7: 'b' })).toHaveLength(1);
  });
});

describe('"Not quite right?" buttons', () => {
  const average = (assignment: Assignment, pick: (s: Student) => boolean) => {
    const seats = students.filter(pick).map((s) => room.seats[room.seatIndex.get(seatOf(assignment, s.id))!]);
    return seats.reduce((sum, s) => sum + s.closeness, 0) / seats.length;
  };

  it('"Keep 1s closer to me" brings the 1s closer, more so on the second click', () => {
    const ones = (s: Student) => s.level === 1;
    const off = average(placeStudents(input).assignment, ones);
    const once = average(placeStudents({ ...input, feedback: { spreadOutOnes: 0, onesCloserToMe: 1, fewerOnesPerTable: 0 } }).assignment, ones);
    const twice = average(placeStudents({ ...input, feedback: { spreadOutOnes: 0, onesCloserToMe: 2, fewerOnesPerTable: 0 } }).assignment, ones);
    expect(once).toBeGreaterThanOrEqual(off);
    expect(twice).toBeGreaterThanOrEqual(once);
  });
});
