import { EMPTY } from './scoring';
import type { Scorer } from './scoring';

// Small seeded generator so the same seed gives the same seating.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SearchPlan = {
  random: () => number;
  // Seat of each locked student; they never move.
  locked: Map<number, number>;
  // Students in the order a greedy start seats them.
  priority: number[];
  startFrom: 'greedy' | 'random';
  runs: number;
  moves: number;
  startTemperature: number;
  endTemperature: number;
};

function lockedSeats(plan: SearchPlan): Set<number> {
  return new Set(plan.locked.values());
}

// Locked students first, then each student in priority order into the open
// seat that adds the least.
function greedyStart(scorer: Scorer, plan: SearchPlan): void {
  scorer.setAssignment(new Int32Array(scorer.studentCount).fill(EMPTY));
  for (const [student, seat] of plan.locked) scorer.place(student, seat);
  for (const student of plan.priority) {
    if (plan.locked.has(student)) continue;
    let bestSeat = EMPTY;
    let bestDelta = Infinity;
    for (let seat = 0; seat < scorer.seatCount; seat++) {
      if (scorer.studentAt[seat] !== EMPTY) continue;
      const delta = scorer.placeDelta(student, seat);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestSeat = seat;
      }
    }
    if (bestSeat === EMPTY) break;
    scorer.place(student, bestSeat);
  }
}

// Locked students first, everyone else into random open seats; students who
// don't fit stay unseated, the lowest priority first.
function randomStart(scorer: Scorer, plan: SearchPlan): void {
  scorer.setAssignment(new Int32Array(scorer.studentCount).fill(EMPTY));
  for (const [student, seat] of plan.locked) scorer.place(student, seat);
  const taken = lockedSeats(plan);
  const open = Array.from({ length: scorer.seatCount }, (_, t) => t).filter((t) => !taken.has(t));
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(plan.random() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  const free = plan.priority.filter((s) => !plan.locked.has(s));
  free.slice(0, open.length).forEach((student, i) => scorer.place(student, open[i]));
}

// Simulated annealing over swaps and moves between seats: early on it accepts
// some worse steps to get out of dead ends, then settles.
function anneal(scorer: Scorer, plan: SearchPlan): number {
  const locked = lockedSeats(plan);
  const movable = Array.from({ length: scorer.seatCount }, (_, t) => t).filter((t) => !locked.has(t));
  let current = scorer.total();
  let best = current;
  let bestSeats = Int32Array.from(scorer.seatOf);
  if (movable.length < 2) return best;

  const cooling = Math.pow(plan.endTemperature / plan.startTemperature, 1 / plan.moves);
  let temperature = plan.startTemperature;
  for (let step = 0; step < plan.moves; step++, temperature *= cooling) {
    const seatA = movable[Math.floor(plan.random() * movable.length)];
    const seatB = movable[Math.floor(plan.random() * movable.length)];
    if (seatA === seatB || (scorer.studentAt[seatA] === EMPTY && scorer.studentAt[seatB] === EMPTY)) continue;
    const delta = scorer.swapDelta(seatA, seatB);
    if (delta > 0 && plan.random() >= Math.exp(-delta / temperature)) continue;
    scorer.swap(seatA, seatB);
    current += delta;
    if (current < best - 1e-9) {
      best = current;
      bestSeats = Int32Array.from(scorer.seatOf);
    }
  }
  scorer.setAssignment(bestSeats);
  return best;
}

// Several runs, keeping the best. With a greedy start, only the first run
// starts greedy; the others start from random seatings.
export function search(scorer: Scorer, plan: SearchPlan): number {
  let best = Infinity;
  let bestSeats = new Int32Array(scorer.studentCount).fill(EMPTY);
  for (let run = 0; run < plan.runs; run++) {
    if (plan.startFrom === 'greedy' && run === 0) greedyStart(scorer, plan);
    else randomStart(scorer, plan);
    const score = anneal(scorer, plan);
    if (score < best) {
      best = score;
      bestSeats = Int32Array.from(scorer.seatOf);
    }
  }
  scorer.setAssignment(bestSeats);
  return best;
}
