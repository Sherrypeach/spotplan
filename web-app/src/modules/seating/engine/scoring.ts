import { oneSeatCap } from './labels';
import type { Room } from './room';
import type { EngineSettings } from './settings';
import type { Assignment, Feedback, KeepApart, NeedKind, SeatLabels, Student } from './types';
import { levelOrThree, NO_FEEDBACK } from './types';

export type ScoreInput = {
  room: Room;
  students: Student[];
  labels: SeatLabels;
  keepApart?: KeepApart[];
  // The chart on screen, which a shuffle steers away from.
  current?: Assignment;
  // Saved charts in the same layout, newest first.
  saved?: Assignment[];
  feedback?: Feedback;
  balanceColors?: boolean;
};

function sameChart(a: Assignment, b: Assignment): boolean {
  const seats = Object.keys(a);
  return seats.length === Object.keys(b).length && seats.every((seat) => a[seat] === b[seat]);
}

const NEED_KINDS: NeedKind[] = [
  'near-front',
  'face-front',
  'close-to-teacher',
  'near-door',
  'helper-nearby',
  'fewer-neighbors',
];
const NEED_INDEX = Object.fromEntries(NEED_KINDS.map((need, i) => [need, i])) as Record<NeedKind, number>;

// No student in a seat, or no seat for a student.
export const EMPTY = -1;

/**
 * Scores a seating by how badly it breaks the rules (lower is better), and the
 * change from swapping two seats without rescoring the whole room. Students
 * and seats are numbered by their position in the input lists.
 */
export class Scorer {
  readonly seatCount: number;
  readonly studentCount: number;
  readonly studentAt: Int32Array;
  readonly seatOf: Int32Array;

  private readonly settings: EngineSettings;
  private readonly level: Int8Array;
  private readonly color: Int16Array;
  private readonly needWeight: Float64Array;
  private readonly unary: Float64Array;
  private readonly neighborHistory = new Map<number, number>();
  private readonly bufferHistory: Float64Array;
  private readonly keepApartOf: number[][];
  private readonly relation: Uint8Array;
  private readonly groupCap: Int32Array;
  private readonly extraOneCost: number;
  private readonly spreadOnes: number;
  // Share of the class with each color tag, and a scratch count per color.
  private readonly colorShare: Float64Array;
  private readonly colorCount: Float64Array;
  private readonly balanceColors: boolean;
  // Scratch marks for localCost, reused on every call to avoid allocations.
  private readonly changedMark: Int32Array;
  private readonly aroundMark: Int32Array;
  private readonly studentMark: Int32Array;
  private readonly aroundList: Int32Array;
  private readonly studentList: Int32Array;
  private stamp = 0;

  constructor(
    private readonly room: Room,
    private readonly input: ScoreInput,
    noise?: () => number,
  ) {
    const { students } = input;
    this.settings = room.settings;
    this.seatCount = room.seats.length;
    this.studentCount = students.length;
    this.studentAt = new Int32Array(this.seatCount).fill(EMPTY);
    this.seatOf = new Int32Array(this.studentCount).fill(EMPTY);
    this.changedMark = new Int32Array(this.seatCount);
    this.aroundMark = new Int32Array(this.seatCount);
    this.studentMark = new Int32Array(this.studentCount);
    this.aroundList = new Int32Array(this.seatCount);
    this.studentList = new Int32Array(this.studentCount);
    this.level = Int8Array.from(students.map(levelOrThree));
    this.color = Int16Array.from(students.map((s) => s.color ?? -1));
    this.needWeight = new Float64Array(this.studentCount * NEED_KINDS.length);
    students.forEach((s, i) =>
      NEED_KINDS.forEach((need, k) => {
        const strength = s.needs[need];
        this.needWeight[i * NEED_KINDS.length + k] = strength ? this.settings.needWeight[strength] : 0;
      }),
    );

    // 1 = next to, 2 = close by.
    this.relation = new Uint8Array(this.seatCount * this.seatCount);
    room.neighbors.forEach((list, a) => list.forEach((b) => (this.relation[a * this.seatCount + b] = 1)));
    room.close.forEach((list, a) => list.forEach((b) => (this.relation[a * this.seatCount + b] = 2)));

    const feedback = input.feedback ?? NO_FEEDBACK;
    this.groupCap = Int32Array.from(room.groups, (group) =>
      feedback.fewerOnesPerTable > 0 ? 1 : oneSeatCap(group.length, this.settings),
    );
    this.extraOneCost =
      feedback.fewerOnesPerTable > 0
        ? this.settings.feedback.fewerOnesExtraOne[feedback.fewerOnesPerTable - 1]
        : this.settings.cost.groupExtraOne;
    this.spreadOnes = this.settings.feedback.spreadOnesPerLevel * feedback.spreadOutOnes;

    this.balanceColors = !!input.balanceColors;
    const colors = students.map((s) => s.color).filter((color): color is number => color !== null);
    const colorSlots = Math.max(0, ...colors) + 1;
    this.colorShare = new Float64Array(colorSlots);
    this.colorCount = new Float64Array(colorSlots);
    for (const color of colors) this.colorShare[color] += 1 / colors.length;

    const studentIndex = new Map(students.map((s, i) => [s.id, i]));
    this.keepApartOf = students.map(() => []);
    for (const pair of input.keepApart ?? []) {
      const a = studentIndex.get(pair.a);
      const b = studentIndex.get(pair.b);
      if (a === undefined || b === undefined || a === b) continue;
      this.keepApartOf[a].push(b);
      this.keepApartOf[b].push(a);
    }

    this.bufferHistory = new Float64Array(this.studentCount);
    this.unary = new Float64Array(this.studentCount * this.seatCount);
    this.fillUnary(feedback, noise);
    this.addHistory(studentIndex);
  }

  private needOf(student: number, need: NeedKind): number {
    return this.needWeight[student * NEED_KINDS.length + NEED_INDEX[need]];
  }

  // --- Costs of one student in one seat ----------------------------------

  private levelFit(level: number, label: number): number {
    const c = this.settings.cost;
    if (level === 1) return label === 2 ? c.oneInTwoSeat : label === 3 ? c.oneInThreeSeat : 0;
    if (level === 2) return label === 3 ? c.twoInThreeSeat : label === 1 ? c.twoInOneSeat : 0;
    return label === 1 ? c.threeInOneSeat : label === 2 ? c.threeInTwoSeat : 0;
  }

  // How far down a ranking a seat is, beyond the share that counts as met.
  private static beyond(rank: number, freeShare: number): number {
    return Math.max(0, rank - freeShare);
  }

  private fillUnary(feedback: Feedback, noise?: () => number): void {
    const { room } = this;
    const c = this.settings.cost;
    const closerPerLevel = this.settings.feedback.onesCloserPerLevel * feedback.onesCloserToMe;
    for (let s = 0; s < this.studentCount; s++) {
      const nearFront = this.needOf(s, 'near-front');
      const faceFront = this.needOf(s, 'face-front');
      const closeToMe = this.needOf(s, 'close-to-teacher');
      const nearDoor = this.needOf(s, 'near-door');
      for (let t = 0; t < this.seatCount; t++) {
        const seat = room.seats[t];
        let cost = this.levelFit(this.level[s], this.input.labels[seat.id] ?? 3);
        cost += c.nearFront * nearFront * Scorer.beyond(room.frontRank[t], c.nearFrontFreeShare);
        if (faceFront > 0 && !room.facesFront[t]) {
          const turnedAway = (this.settings.facing.facesFrontAt - seat.facingFront) / (this.settings.facing.facesFrontAt + 1);
          cost += faceFront * (c.faceFrontMin + (c.faceFrontMax - c.faceFrontMin) * turnedAway);
        }
        cost += c.closeToMe * closeToMe * Scorer.beyond(room.closenessRank[t], c.closeToMeFreeShare);
        if (room.doorRank) cost += c.nearDoor * nearDoor * Scorer.beyond(room.doorRank[t], c.nearDoorFreeShare);
        if (this.level[s] === 1) cost += closerPerLevel * (1 - seat.closeness);
        if (noise) cost += noise();
        this.unary[s * this.seatCount + t] = cost;
      }
    }
  }

  private addHistory(studentIndex: Map<string, number>): void {
    const { history } = this.settings;
    const charts: [Assignment, { sameSeat: number; sameNeighbor: number; sameBuffer: number }][] = [];
    const { current } = this.input;
    if (current) charts.push([current, history.current]);
    // A saved chart that is also the one on screen is already counted above.
    const saved = (this.input.saved ?? []).filter((chart) => !current || !sameChart(chart, current));
    saved.slice(0, history.saved.length).forEach((chart, i) => charts.push([chart, history.saved[i]]));

    for (const [chart, weights] of charts) {
      const seated = new Int32Array(this.seatCount).fill(EMPTY);
      for (const [seatId, studentId] of Object.entries(chart)) {
        const t = this.room.seatIndex.get(seatId);
        const s = studentIndex.get(studentId);
        if (t === undefined || s === undefined) continue;
        seated[t] = s;
        this.unary[s * this.seatCount + t] += weights.sameSeat;
      }
      for (let t = 0; t < this.seatCount; t++) {
        const s = seated[t];
        if (s === EMPTY) continue;
        let besideOne = false;
        for (const n of this.room.neighbors[t]) {
          const other = seated[n];
          if (other === EMPTY) continue;
          if (this.level[other] === 1) besideOne = true;
          if (s < other) {
            const key = s * this.studentCount + other;
            this.neighborHistory.set(key, (this.neighborHistory.get(key) ?? 0) + weights.sameNeighbor);
          }
        }
        if (besideOne && this.level[s] === 3) this.bufferHistory[s] += weights.sameBuffer;
      }
    }
  }

  // --- Costs that depend on who sits around whom --------------------------

  private pairCost(a: number, b: number, seatA: number, seatB: number): number {
    const c = this.settings.cost;
    const levelA = this.level[a];
    const levelB = this.level[b];
    let cost = 0;
    if (levelA === 1 && levelB === 1) cost += c.onesSideBySide;
    if ((levelA === 1 && levelB === 2) || (levelA === 2 && levelB === 1)) {
      const together = (this.room.seats[seatA].closeness + this.room.seats[seatB].closeness) / 2;
      cost += c.oneBesideTwo + c.oneBesideTwoFar * (1 - together);
    }
    if (this.balanceColors && this.color[a] >= 0 && this.color[a] === this.color[b]) cost += c.sameColorNeighbors;
    const key = a < b ? a * this.studentCount + b : b * this.studentCount + a;
    cost += this.neighborHistory.get(key) ?? 0;
    if (levelA === 3 && levelB === 1) cost += this.bufferHistory[a];
    if (levelB === 3 && levelA === 1) cost += this.bufferHistory[b];
    return cost;
  }

  private surroundingsCost(student: number, seat: number): number {
    const c = this.settings.cost;
    const helper = this.needOf(student, 'helper-nearby');
    const fewer = this.needOf(student, 'fewer-neighbors');
    if (helper === 0 && fewer === 0) return 0;
    let count = 0;
    let hasThree = false;
    for (const n of this.room.neighbors[seat]) {
      const other = this.studentAt[n];
      if (other === EMPTY) continue;
      count++;
      if (this.level[other] === 3) hasThree = true;
    }
    let cost = 0;
    if (helper > 0 && !hasThree) cost += c.helperMissing * helper;
    if (fewer > 0) cost += fewer * (c.fewerNeighborsEach * count + (c.fewerNeighborsPair * count * (count - 1)) / 2);
    return cost;
  }

  private keepApartCost(seatA: number, seatB: number): number {
    if (seatA === EMPTY || seatB === EMPTY) return 0;
    const c = this.settings.cost;
    const relation = this.relation[seatA * this.seatCount + seatB];
    const groupA = this.room.groupOf[seatA];
    const sameTable = groupA >= 0 && groupA === this.room.groupOf[seatB];
    if (relation === 1) return c.keepApartNextTo + (sameTable ? c.keepApartSameTable : 0);
    if (sameTable) return c.keepApartSameTable;
    return relation === 2 ? c.keepApartClose : 0;
  }

  private groupCost(group: number): number {
    const c = this.settings.cost;
    const seats = this.room.groups[group];
    let count = 0;
    let ones = 0;
    let threes = 0;
    const colors = this.colorCount;
    colors.fill(0);
    for (const t of seats) {
      const s = this.studentAt[t];
      if (s === EMPTY) continue;
      count++;
      if (this.level[s] === 1) ones++;
      if (this.level[s] === 3) threes++;
      if (this.color[s] >= 0) colors[this.color[s]]++;
    }
    let cost = 0;
    if (count >= 2 && threes === 0) cost += c.groupWithoutThree;
    cost += Math.max(0, ones - this.groupCap[group]) * this.extraOneCost;
    if (this.balanceColors) {
      for (let color = 0; color < this.colorShare.length; color++) {
        const share = this.colorShare[color];
        if (share === 0) continue;
        const off = Math.abs(colors[color] - share * count);
        cost += c.groupColorOff * Math.max(0, off - c.groupColorSlack);
      }
    }
    return cost;
  }

  // --- Totals and changes --------------------------------------------------

  setAssignment(seatOfStudent: Int32Array): void {
    this.studentAt.fill(EMPTY);
    this.seatOf.set(seatOfStudent);
    seatOfStudent.forEach((t, s) => {
      if (t !== EMPTY) this.studentAt[t] = s;
    });
  }

  total(): number {
    const all = Array.from({ length: this.seatCount }, (_, t) => t);
    return this.localCost(all, true);
  }

  // Everything a change at `seats` can affect: those seats' students and their
  // neighbors, the pairs they're in, their keep-apart partners and their groups.
  // With `allGroups`, every group is scored (for the full total); otherwise
  // only the groups of the changed seats (at most two).
  private localCost(seats: number[], allGroups = false): number {
    const stamp = ++this.stamp;
    const { changedMark, aroundMark, studentMark, aroundList, studentList } = this;
    for (const t of seats) changedMark[t] = stamp;

    let cost = 0;
    let aroundCount = 0;
    let studentCount = 0;
    let groupA = -1;
    let groupB = -1;

    for (const t of seats) {
      const s = this.studentAt[t];
      if (aroundMark[t] !== stamp) {
        aroundMark[t] = stamp;
        aroundList[aroundCount++] = t;
      }
      if (s !== EMPTY) {
        cost += this.unary[s * this.seatCount + t];
        if (studentMark[s] !== stamp) {
          studentMark[s] = stamp;
          studentList[studentCount++] = s;
        }
      }
      for (const n of this.room.neighbors[t]) {
        if (aroundMark[n] !== stamp) {
          aroundMark[n] = stamp;
          aroundList[aroundCount++] = n;
        }
        const other = this.studentAt[n];
        if (s !== EMPTY && other !== EMPTY && (changedMark[n] !== stamp || t < n)) cost += this.pairCost(s, other, t, n);
      }
      if (this.spreadOnes > 0 && s !== EMPTY && this.level[s] === 1) {
        for (const n of this.room.close[t]) {
          const other = this.studentAt[n];
          if (other !== EMPTY && this.level[other] === 1 && (changedMark[n] !== stamp || t < n)) cost += this.spreadOnes;
        }
      }
      const group = this.room.groupOf[t];
      if (!allGroups && group >= 0 && group !== groupA && group !== groupB) {
        if (groupA < 0) groupA = group;
        else groupB = group;
      }
    }

    // Students whose surroundings changed: in a changed seat or next to one.
    for (let i = 0; i < aroundCount; i++) {
      const t = aroundList[i];
      const s = this.studentAt[t];
      if (s !== EMPTY) cost += this.surroundingsCost(s, t);
    }
    for (let i = 0; i < studentCount; i++) {
      const s = studentList[i];
      for (const partner of this.keepApartOf[s]) {
        if (studentMark[partner] === stamp && partner < s) continue;
        cost += this.keepApartCost(this.seatOf[s], this.seatOf[partner]);
      }
    }
    if (allGroups) {
      for (let g = 0; g < this.room.groups.length; g++) cost += this.groupCost(g);
    } else {
      if (groupA >= 0) cost += this.groupCost(groupA);
      if (groupB >= 0) cost += this.groupCost(groupB);
    }
    return cost;
  }

  private moveBetween(seatA: number, seatB: number): void {
    const a = this.studentAt[seatA];
    const b = this.studentAt[seatB];
    this.studentAt[seatA] = b;
    this.studentAt[seatB] = a;
    if (a !== EMPTY) this.seatOf[a] = seatB;
    if (b !== EMPTY) this.seatOf[b] = seatA;
  }

  // Change in total from swapping two seats (either may be empty); leaves the
  // seating as it was.
  swapDelta(seatA: number, seatB: number): number {
    const before = this.localCost([seatA, seatB]);
    this.moveBetween(seatA, seatB);
    const after = this.localCost([seatA, seatB]);
    this.moveBetween(seatA, seatB);
    return after - before;
  }

  swap(seatA: number, seatB: number): void {
    this.moveBetween(seatA, seatB);
  }

  // Change in total from seating an unseated student in an empty seat.
  placeDelta(student: number, seat: number): number {
    const before = this.localCost([seat]);
    this.place(student, seat);
    const after = this.localCost([seat]);
    this.unplace(student, seat);
    return after - before;
  }

  place(student: number, seat: number): void {
    this.studentAt[seat] = student;
    this.seatOf[student] = seat;
  }

  private unplace(student: number, seat: number): void {
    this.studentAt[seat] = EMPTY;
    this.seatOf[student] = EMPTY;
  }

  toAssignment(): Assignment {
    const assignment: Assignment = {};
    this.studentAt.forEach((s, t) => {
      if (s !== EMPTY) assignment[this.room.seats[t].id] = this.input.students[s].id;
    });
    return assignment;
  }
}
