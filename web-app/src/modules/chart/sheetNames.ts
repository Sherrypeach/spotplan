import type { Box, Point } from '@modules/room/roomGeometry';
import { textWidth } from '@shared/text';

/**
 * Where each name goes on the chart. Every name is written in full, all at
 * one size, on a sticker that never covers another name, a desk of another
 * table, the board or the teacher's furniture. Names sit on their desks when
 * they fit; at a table too small for them, every name of that table moves
 * beside its own chair instead, so a table never mixes the two.
 */

/** One seated student, in sheet units. */
export type NameSeat = {
  id: string;
  name: string;
  color: number | null;
  /** The table (or rug) the seat belongs to. */
  table: string;
  /** The chair's middle, or the spot on a rug. */
  chair: Point;
  /** Where the name sits on the desk or table (or right on a rug spot), and how wide it may be there. */
  onDesk: { x: number; y: number; room: number } | null;
  /** A desk of its own that's turned: the name may run along it instead. */
  along: { angle: number; room: number } | null;
  /** From the table's middle out through the chair: the way to go beside it. */
  away: Point;
  /** How far from the chair's middle a name beside it starts. */
  reach: number;
};

/** Something names keep off: a desk or chair belongs to its table (and seat). */
export type Obstacle = { box: Box; table?: string; seat?: string };

export type NameTag = {
  id: string;
  name: string;
  /** The name as written: one line, or split in two at a space or hyphen. */
  lines: string[];
  color: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 flat, or the angle of the desk the name runs along. */
  angle: number;
  /** Beside the chair rather than on the desk. */
  beside: boolean;
};

export type NamePlan = { font: number; tags: NameTag[] };

// A sticker's height for one line, each line after it, its padding on each side and its color dot, as shares of the font size.
const TAG_HEIGHT = 1.5;
export const LINE_HEIGHT = 1.15;
const TAG_PADDING = 0.45;
const DOT_ROOM = 0.9;
// Space between a chair and the name beside it, and between two names, as shares of the font size.
const BESIDE_GAP = 0.25;
const TAG_GAP = 0.2;
// Ways to try beside a chair: straight out, then a little to each side, then square to it.
const BESIDE_TURNS = [0, 35, -35, 70, -70, 110, -110, 180];
// Further out, as multiples of the first reach, when the closest spots are taken.
const BESIDE_RINGS = [1, 1.6];

/** How big a name's sticker is at this font size. */
export function tagSize(lines: string[], color: number | null, font: number): { width: number; height: number } {
  const widest = Math.max(...lines.map((line) => textWidth(line, font)));
  return { width: widest + font * TAG_PADDING * 2 + (color === null ? 0 : font * DOT_ROOM), height: font * (TAG_HEIGHT + (lines.length - 1) * LINE_HEIGHT) };
}

/** A name on one line, and, when it has a space or hyphen, also on two lines split where they come out most even. */
const shapes = new Map<string, string[][]>();

export function nameShapes(name: string): string[][] {
  const known = shapes.get(name);
  if (known) return known;
  const made = splitName(name);
  if (shapes.size >= SHAPES_LIMIT) shapes.clear();
  shapes.set(name, made);
  return made;
}

// Names already split, kept while the chart tries sizes and spots.
const SHAPES_LIMIT = 2000;

function splitName(name: string): string[][] {
  const breaks = [...name.matchAll(/[ -]/g)].map((match) => match.index);
  if (breaks.length === 0) return [[name]];
  const split = (at: number) => [name.slice(0, name[at] === '-' ? at + 1 : at).trim(), name.slice(at + 1).trim()];
  const best = breaks.map(split).reduce((a, b) => (Math.max(textWidth(b[0], 1), textWidth(b[1], 1)) < Math.max(textWidth(a[0], 1), textWidth(a[1], 1)) ? b : a));
  return [[name], best];
}

function overlap(a: Box, b: Box): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? x * y : 0;
}

function boxAt(x: number, y: number, width: number, height: number, angle = 0): Box {
  // A sticker turned to run along a desk takes the room of its turned outline.
  const radians = (angle * Math.PI) / 180;
  const w = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const h = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
}

function grow(box: Box, by: number): Box {
  return { left: box.left - by, right: box.right + by, top: box.top - by, bottom: box.bottom + by };
}

function inside(box: Box, bounds: Box): boolean {
  return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
}

type Candidate = { tag: NameTag; box: Box };

/** How much a sticker here would cover: zero means it's free. */
function clash(candidate: Candidate, blocked: Obstacle[], placed: Box[], bounds: Box, keepsOff: (obstacle: Obstacle) => boolean, gap: number): number {
  const padded = grow(candidate.box, gap);
  let covered = inside(candidate.box, bounds) ? 0 : candidate.tag.width * candidate.tag.height;
  for (const box of placed) covered += overlap(padded, box);
  for (const obstacle of blocked) if (keepsOff(obstacle)) covered += overlap(candidate.box, obstacle.box);
  return covered;
}

// Spots near the desk, in order: on the desk, between the desk and the chair, on the chair.
const NEAR_SHARES = [0, 0.5, 1];

function makeTag(seat: NameSeat, lines: string[], x: number, y: number, font: number, angle: number, beside: boolean): Candidate {
  const { width, height } = tagSize(lines, seat.color, font);
  const tag = { id: seat.id, name: seat.name, lines, color: seat.color, x, y, width, height, angle, beside };
  return { tag, box: boxAt(x, y, width, height, angle) };
}

function nearCandidates(seat: NameSeat, font: number): Candidate[] {
  const desk = seat.onDesk;
  if (!desk) return [];
  // Each spot on one line, then on two, before moving on to the next spot.
  const shapes = nameShapes(seat.name);
  return [
    ...NEAR_SHARES.flatMap((share) => shapes.map((lines) => makeTag(seat, lines, desk.x + (seat.chair.x - desk.x) * share, desk.y + (seat.chair.y - desk.y) * share, font, 0, false))),
    ...shapes.flatMap((lines) => (seat.along && tagSize(lines, seat.color, font).width <= seat.along.room ? [makeTag(seat, lines, desk.x, desk.y, font, seat.along.angle, false)] : [])),
  ];
}

function besideCandidates(seat: NameSeat, font: number): Candidate[] {
  const base = Math.atan2(seat.away.y, seat.away.x);
  return nameShapes(seat.name).flatMap((lines) => {
    const { width, height } = tagSize(lines, seat.color, font);
    return BESIDE_RINGS.flatMap((ring) =>
      BESIDE_TURNS.map((turn) => {
        const radians = base + (turn * Math.PI) / 180;
        const [ux, uy] = [Math.cos(radians), Math.sin(radians)];
        // Far enough out that the sticker's nearest edge clears the chair.
        const reach = (seat.reach + font * BESIDE_GAP) * ring + Math.abs(ux) * (width / 2) + Math.abs(uy) * (height / 2);
        return makeTag(seat, lines, seat.chair.x + ux * reach, seat.chair.y + uy * reach, font, 0, true);
      }),
    );
  });
}

/** Places every name at one font size; `misses` counts names that found no free spot. */
function placeAt(seats: NameSeat[], obstacles: Obstacle[], bounds: Box, font: number): { tags: NameTag[]; misses: number; beside: number } {
  const gap = font * TAG_GAP;
  const placed: Box[] = [];
  const tags: NameTag[] = [];
  let misses = 0;
  let beside = 0;
  const tables = new Map<string, NameSeat[]>();
  for (const seat of seats) tables.set(seat.table, [...(tables.get(seat.table) ?? []), seat]);
  for (const members of tables.values()) {
    // On their desks, every one of them, or none.
    const onDesk: Candidate[] = [];
    for (const seat of members) {
      const free = nearCandidates(seat, font).find(
        (candidate) => clash(candidate, obstacles, [...placed, ...onDesk.map((other) => other.box)], bounds, (obstacle) => obstacle.table !== seat.table, gap) === 0,
      );
      if (!free) break;
      onDesk.push(free);
    }
    if (onDesk.length === members.length) {
      for (const candidate of onDesk) {
        tags.push(candidate.tag);
        placed.push(candidate.box);
      }
      continue;
    }
    for (const seat of members) {
      const candidates = besideCandidates(seat, font);
      const scored = candidates.map((candidate) => ({ candidate, covered: clash(candidate, obstacles, placed, bounds, () => true, gap) }));
      const free = scored.find(({ covered }) => covered === 0);
      // No free spot: the one that covers least, and it counts against this size.
      const best = free ?? scored.reduce((a, b) => (b.covered < a.covered ? b : a));
      if (!free) misses += 1;
      beside += 1;
      tags.push(best.candidate.tag);
      placed.push(best.candidate.box);
    }
  }
  return { tags, misses, beside };
}

/**
 * The biggest single font size, from `sizes` (largest first), at which every
 * name finds a free spot, keeping as many names on their desks as any size
 * can. Only when no size works for all of them are the `smaller` sizes tried;
 * failing those too, the size that leaves the fewest names without a spot.
 */
export function placeNames(seats: NameSeat[], obstacles: Obstacle[], bounds: Box, sizes: number[], smaller: number[] = []): NamePlan {
  const tries: ({ font: number } & ReturnType<typeof placeAt>)[] = [];
  for (const font of sizes) {
    const attempt = { font, ...placeAt(seats, obstacles, bounds, font) };
    // Every name on its desk at the biggest size that fits: nothing smaller can do better.
    if (attempt.misses === 0 && attempt.beside === 0) return { font, tags: attempt.tags };
    tries.push(attempt);
  }
  let working = tries.filter((attempt) => attempt.misses === 0);
  for (const font of smaller) {
    if (working.length > 0) break;
    const attempt = { font, ...placeAt(seats, obstacles, bounds, font) };
    tries.push(attempt);
    if (attempt.misses === 0) working = [attempt];
  }
  if (working.length === 0) {
    const fewest = Math.min(...tries.map((attempt) => attempt.misses));
    const best = tries.find((attempt) => attempt.misses === fewest)!;
    return { font: best.font, tags: best.tags };
  }
  const leastBeside = Math.min(...working.map((attempt) => attempt.beside));
  const best = working.find((attempt) => attempt.beside === leastBeside)!;
  return { font: best.font, tags: best.tags };
}

/** Font sizes from `largest` down to `smallest`, one unit apart. */
export function fontSizes(largest: number, smallest: number): number[] {
  return Array.from({ length: largest - smallest + 1 }, (_, index) => largest - index);
}
