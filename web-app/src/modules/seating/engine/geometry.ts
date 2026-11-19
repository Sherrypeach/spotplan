import type { Furniture } from '@modules/layouts/types';

import type { Point } from './types';

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function localOutline(piece: Furniture): Point[] {
  const { w, h } = piece;
  if (piece.kind === 'trapezoid-table') {
    const inset = piece.inset * w;
    return [
      { x: inset, y: 0 },
      { x: w - inset, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  }
  if (piece.kind === 'triangle-table') {
    return [
      { x: 0, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

// Corners of a piece on the stage: mirror, rotate, then move to its center.
export function furnitureOutline(piece: Furniture): Point[] {
  const radians = (piece.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return localOutline(piece).map((corner) => {
    const localX = (corner.x - piece.w / 2) * (piece.flipH ? -1 : 1);
    const localY = corner.y - piece.h / 2;
    return {
      x: piece.x + localX * cos - localY * sin,
      y: piece.y + localX * sin + localY * cos,
    };
  });
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + clamped * dx, y: a.y + clamped * dy });
}

function isInside(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function edges(polygon: Point[]): [Point, Point][] {
  return polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]]);
}

// Distance from a point to a marker (one point), a wall item (two points) or
// an outline; 0 inside an outline.
export function distanceToShape(p: Point, shape: Point[]): number {
  if (shape.length === 1) return distance(p, shape[0]);
  if (shape.length === 2) return distanceToSegment(p, shape[0], shape[1]);
  if (isInside(p, shape)) return 0;
  return Math.min(...edges(shape).map(([a, b]) => distanceToSegment(p, a, b)));
}

// Gap between two convex outlines; 0 when they touch or overlap.
export function outlineGap(a: Point[], b: Point[]): number {
  if (a.some((p) => isInside(p, b)) || b.some((p) => isInside(p, a))) return 0;
  let gap = Infinity;
  for (const p of a) {
    for (const [s, e] of edges(b)) gap = Math.min(gap, distanceToSegment(p, s, e));
  }
  for (const p of b) {
    for (const [s, e] of edges(a)) gap = Math.min(gap, distanceToSegment(p, s, e));
  }
  return gap;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
