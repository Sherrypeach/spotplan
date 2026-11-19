import type { Room, RoomSeat } from './room';
import type { EngineSettings } from './settings';
import type { Level, SeatLabels, Student } from './types';

export type LabelCounts = Record<Level, number>;

// How many seats get each label: a 1 seat per level 1 student plus 15% (always
// at least one spare, which a 2 can take), a 2 seat per level 2 student, and
// 3s for the rest. Without 1s or 2s yet, a typical share of the seats.
export function labelCounts(room: Room, students: Student[] = []): LabelCounts {
  const seatCount = room.seats.length;
  const { onesExtraShare, onesShareWithoutRoster, twosShareWithoutRoster } = room.settings.labels;
  const levelOne = students.filter((s) => s.level === 1).length;
  const levelTwo = students.filter((s) => s.level === 2).length;
  const wantedOnes =
    levelOne > 0
      ? Math.max(levelOne + 1, Math.round(levelOne * (1 + onesExtraShare)))
      : Math.round(seatCount * onesShareWithoutRoster);
  const wantedTwos = levelTwo > 0 ? levelTwo : Math.round(seatCount * twosShareWithoutRoster);
  const ones = Math.min(seatCount, wantedOnes);
  const twos = Math.min(seatCount - ones, wantedTwos);
  return { 1: ones, 2: twos, 3: seatCount - ones - twos };
}

// Most 1 seats a group can hold: 1 under 4 seats, 2 up to 7, 3 from 8.
export function oneSeatCap(groupSize: number, settings: EngineSettings): number {
  return settings.labels.groupCaps.find((c) => groupSize <= c.maxSeats)!.cap;
}

function groupCap(room: Room, seat: RoomSeat): number {
  const group = room.groupOf[seat.index];
  return group < 0 ? Infinity : oneSeatCap(room.groups[group].length, room.settings);
}

function byCloseness(a: RoomSeat, b: RoomSeat): number {
  return b.closeness - a.closeness || a.desksFromTeacher - b.desksFromTeacher || a.index - b.index;
}

function nextToLabel(room: Room, labels: SeatLabels, seat: RoomSeat, level: Level): number {
  return room.neighbors[seat.index].filter((n) => labels[room.seats[n].id] === level).length;
}

function onesInGroup(room: Room, labels: SeatLabels, seat: RoomSeat): number {
  const group = room.groupOf[seat.index];
  if (group < 0) return 0;
  return room.groups[group].filter((n) => labels[room.seats[n].id] === 1).length;
}

// 1 seats from the closest down, skipping seats next to another 1 seat and
// keeping each group under its cap. Short on seats, the cap gives way first,
// then the next-to rule.
function pickOnes(room: Room, labels: SeatLabels, count: number): void {
  const ranked = [...room.seats].sort(byCloseness);
  const passes = [
    (seat: RoomSeat) => nextToLabel(room, labels, seat, 1) === 0 && onesInGroup(room, labels, seat) < groupCap(room, seat),
    (seat: RoomSeat) => nextToLabel(room, labels, seat, 1) === 0,
    () => true,
  ];
  let taken = 0;
  for (const allowed of passes) {
    for (const seat of ranked) {
      if (taken >= count) return;
      if (labels[seat.id] || !allowed(seat)) continue;
      labels[seat.id] = 1;
      taken++;
    }
  }
}

// 2 seats one at a time: the closest left, less a penalty for sitting beside a
// 1 seat far from the teacher and a small one for clumps of 2s.
function pickTwos(room: Room, labels: SeatLabels, count: number): void {
  const { twoBesideOneSeatPenalty, twoClumpPenalty } = room.settings.labels;
  const { farBelow } = room.settings.closeness;
  const appeal = (seat: RoomSeat) => {
    const besideFarOne = seat.closeness < farBelow && nextToLabel(room, labels, seat, 1) > 0;
    const clump = twoClumpPenalty * nextToLabel(room, labels, seat, 2);
    return seat.closeness - (besideFarOne ? twoBesideOneSeatPenalty : 0) - clump;
  };
  for (let taken = 0; taken < count; taken++) {
    const open = room.seats.filter((seat) => !labels[seat.id]);
    if (open.length === 0) return;
    const best = open.reduce((a, b) => (appeal(b) > appeal(a) ? b : a));
    labels[best.id] = 2;
  }
}

// Suggested 1/2/3 label for every seat. Labels the teacher set by hand are kept
// and count toward the totals.
export function suggestSeatLabels(room: Room, counts: LabelCounts, handSet: SeatLabels = {}): SeatLabels {
  const labels: SeatLabels = {};
  for (const seat of room.seats) {
    if (handSet[seat.id]) labels[seat.id] = handSet[seat.id];
  }
  const already = (level: Level) => Object.values(labels).filter((l) => l === level).length;
  pickOnes(room, labels, counts[1] - already(1));
  pickTwos(room, labels, counts[2] - already(2));
  for (const seat of room.seats) {
    if (!labels[seat.id]) labels[seat.id] = 3;
  }
  return labels;
}
