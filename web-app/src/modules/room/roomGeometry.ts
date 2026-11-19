import type { DocPiece, DocRoom } from '@modules/classroom/document';
import type { Furniture } from '@modules/layouts/types';
import { distance, furnitureOutline } from '@modules/seating/engine/geometry';

export type Pt = [number, number];

/** A piece this close to a wall (in room units) only touches it, and still counts as on the floor. */
export const TOUCHING = 0.5;

/** The missing corner of an L as a box, or null for a rectangle. */
export function cutBox(room: DocRoom): Box | null {
  if (room.shape !== 'l-shape' || !room.cutCorner || !room.cutWidth || !room.cutDepth) return null;
  const left = room.cutCorner.endsWith('left') ? 0 : room.width - room.cutWidth;
  const top = room.cutCorner.startsWith('top') ? 0 : room.depth - room.cutDepth;
  return { left, top, right: left + room.cutWidth, bottom: top + room.cutDepth };
}

/**
 * The point moved onto the floor, at least `gap` from every wall: inside the
 * outer walls, and out of an L-shaped room's missing corner to its nearest side.
 */
export function pointOnFloor(room: DocRoom, x: number, y: number, gap: number): { x: number; y: number } {
  const clamp = (value: number, limit: number) => Math.min(Math.max(value, gap), limit - gap);
  let at = { x: clamp(x, room.width), y: clamp(y, room.depth) };
  const box = cutBox(room);
  if (box) {
    const away = { left: box.left - gap, right: box.right + gap, top: box.top - gap, bottom: box.bottom + gap };
    if (at.x > away.left && at.x < away.right && at.y > away.top && at.y < away.bottom) {
      const ways = [
        { x: away.left, y: at.y },
        { x: away.right, y: at.y },
        { x: at.x, y: away.top },
        { x: at.x, y: away.bottom },
      ].filter((p) => p.x >= gap && p.x <= room.width - gap && p.y >= gap && p.y <= room.depth - gap);
      at = nearestPoint(at, ways) ?? at;
    }
  }
  return { x: Math.round(at.x), y: Math.round(at.y) };
}

/** The candidate closest to `at`, or null when there are none. */
export function nearestPoint<T extends { x: number; y: number }>(at: { x: number; y: number }, candidates: T[]): T | null {
  return candidates.reduce<T | null>((best, p) => (!best || distance(p, at) < distance(best, at) ? p : best), null);
}

/** A piece's angle folded to -90…90, so text along it reads left to right or bottom to top. */
export function readingAngle(piece: { rotation: number }): number {
  return ((((piece.rotation + 90) % 180) + 180) % 180) - 90;
}

/** Turned more than halfway to sideways. */
export function isTurned(piece: { rotation: number }): boolean {
  return Math.abs(readingAngle(piece)) > 45;
}

/** Of a room seen with the board at the top: the front wall, from left to right, minus a missing top corner. */
export function frontWall(room: DocRoom): [number, number] {
  const cut = room.shape === 'l-shape' ? (room.cutWidth ?? 0) : 0;
  if (room.shape === 'l-shape' && room.cutCorner === 'top-left') return [cut, room.width];
  if (room.shape === 'l-shape' && room.cutCorner === 'top-right') return [0, room.width - cut];
  return [0, room.width];
}

/** The floor's outline: a rectangle, or an L with one corner cut out. */
export function floorOutline(room: DocRoom): Pt[] {
  const { width: w, depth: d } = room;
  if (room.shape !== 'l-shape' || !room.cutCorner || !room.cutWidth || !room.cutDepth) {
    return [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
    ];
  }
  const cw = room.cutWidth;
  const cd = room.cutDepth;
  switch (room.cutCorner) {
    case 'top-left':
      return [[cw, 0], [w, 0], [w, d], [0, d], [0, cd], [cw, cd]];
    case 'top-right':
      return [[0, 0], [w - cw, 0], [w - cw, cd], [w, cd], [w, d], [0, d]];
    case 'bottom-left':
      return [[0, 0], [w, 0], [w, d], [cw, d], [cw, d - cd], [0, d - cd]];
    case 'bottom-right':
      return [[0, 0], [w, 0], [w, d - cd], [w - cw, d - cd], [w - cw, d], [0, d]];
  }
}

export type Box = { left: number; top: number; right: number; bottom: number };

export type Point = { x: number; y: number };

export function boxOfPoints(points: Point[]): Box {
  return {
    left: Math.min(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    right: Math.max(...points.map((p) => p.x)),
    bottom: Math.max(...points.map((p) => p.y)),
  };
}

export function boxesTouch(a: Box, b: Box, gap: number): boolean {
  return a.left <= b.right + gap && b.left <= a.right + gap && a.top <= b.bottom + gap && b.top <= a.bottom + gap;
}

/** Groups of items whose boxes touch (within `gap`): each item's group number. */
export function touchGroups(boxes: Box[], gap: number): number[] {
  const parent = boxes.map((_, index) => index);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesTouch(boxes[i], boxes[j], gap)) parent[find(i)] = find(j);
    }
  }
  return boxes.map((_, index) => find(index));
}

/**
 * True when two convex outlines overlap by more than a sliver (separating
 * axis test), so two tables merely touching don't count.
 */
export function outlinesOverlap(a: Point[], b: Point[], tolerance: number): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const p = shape[i];
      const q = shape[(i + 1) % shape.length];
      const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const nx = -(q.y - p.y) / length;
      const ny = (q.x - p.x) / length;
      const project = (points: Point[]) => points.map((point) => point.x * nx + point.y * ny);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) - tolerance <= Math.min(...pb) || Math.max(...pb) - tolerance <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/** True for rugs drawn by their own shape rather than their outline box. */
export function isShapedRug(piece: { kind: string; shape?: string }): boolean {
  return piece.kind === 'carpet' && ['oval', 'circle', 'semicircle', 'wedge'].includes(piece.shape ?? '');
}

/** A piece's outline (corners), turned and flipped like the piece. */
export function pieceOutline(piece: DocPiece): Point[] {
  return furnitureOutline(piece as unknown as Furniture);
}

export function pieceBox(piece: DocPiece): Box {
  return boxOfPoints(pieceOutline(piece));
}

function insidePolygon(point: Point, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** The outline pulled in toward its middle by `by`, so a piece that only touches a wall counts as inside. */
export function shrinkOutline(outline: Point[], by: number): Point[] {
  const cx = outline.reduce((sum, p) => sum + p.x, 0) / outline.length;
  const cy = outline.reduce((sum, p) => sum + p.y, 0) / outline.length;
  return outline.map((p) => {
    const length = Math.hypot(p.x - cx, p.y - cy);
    return length <= by ? { x: cx, y: cy } : { x: p.x - ((p.x - cx) / length) * by, y: p.y - ((p.y - cy) / length) * by };
  });
}

/**
 * True when an outline lies on the floor: every corner on it, no corner of
 * the floor (the inside corner of an L) poking into it, and no edges crossing.
 */
export function outlineOnFloor(outline: Point[], floor: Pt[]): boolean {
  if (!outline.every((corner) => insidePolygon(corner, floor))) return false;
  const floorPoints = floor.map(([x, y]) => ({ x, y }));
  const shape = outline.map((p) => [p.x, p.y] as Pt);
  if (floorPoints.some((corner) => insidePolygon(corner, shape))) return false;
  for (let i = 0; i < outline.length; i++) {
    for (let j = 0; j < floorPoints.length; j++) {
      if (segmentsCross(outline[i], outline[(i + 1) % outline.length], floorPoints[j], floorPoints[(j + 1) % floorPoints.length])) return false;
    }
  }
  return true;
}

/**
 * True when `point` is on the rug: its shape (oval, circle, half circle with
 * the straight edge at the front, wedge with its point at the front, or a
 * rectangle), turned and flipped like the rug. `margin` keeps it that far in.
 */
export function onRug(point: Point, rug: DocPiece, margin = 0): boolean {
  const radians = (-rug.rotation * Math.PI) / 180;
  const dx = point.x - rug.x;
  const dy = point.y - rug.y;
  const x = (dx * Math.cos(radians) - dy * Math.sin(radians)) * (rug.flipH ? -1 : 1);
  const y = dx * Math.sin(radians) + dy * Math.cos(radians);
  const hw = rug.w / 2 - margin;
  const hh = rug.h / 2 - margin;
  if (hw <= 0 || hh <= 0) return false;
  switch (rug.shape) {
    case 'oval':
    case 'circle':
      return (x * x) / (hw * hw) + (y * y) / (hh * hh) <= 1;
    case 'semicircle': {
      // Straight edge at y = -h/2, round side toward the back.
      const top = -rug.h / 2 + margin;
      const r = rug.w / 2 - margin;
      return y >= top && x * x + (y - -rug.h / 2) ** 2 <= r * r;
    }
    case 'wedge': {
      const apexY = -rug.h / 2;
      const half = (((rug.sweep ?? 90) / 2) * Math.PI) / 180;
      const fromApex = Math.hypot(x, y - apexY);
      const angle = Math.atan2(Math.abs(x), y - apexY);
      return fromApex <= rug.h - margin && angle <= half && y - apexY >= margin;
    }
    default:
      return Math.abs(x) <= hw && Math.abs(y) <= hh;
  }
}
