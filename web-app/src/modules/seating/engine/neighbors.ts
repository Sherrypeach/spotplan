import type { Furniture, Seat } from '@modules/layouts/types';

import { distance, furnitureOutline, median, outlineGap } from './geometry';
import type { EngineSettings } from './settings';

export type SeatLinks = {
  // Seat indexes that count as "next to" each seat.
  neighbors: number[][];
  // Close by but not next to (e.g. diagonal desks).
  close: number[][];
  // Group (table or pod of touching pieces) of each seat, or -1.
  groupOf: Int32Array;
  groups: number[][];
};

function facingVector(degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

// 1 = facing the same way, -1 = opposite ways, 0 = at a right angle.
function alignmentOf(a: Seat, b: Seat): number {
  const facingA = facingVector(a.facing);
  const facingB = facingVector(b.facing);
  return facingA.x * facingB.x + facingA.y * facingB.y;
}

// Desks that touch seat neighbors only when the students sit face to face or
// side by side. Diagonal desks and desks at right angles don't count.
function sitFaceToFaceOrSideBySide(a: Seat, b: Seat, deskWidth: number, settings: EngineSettings): boolean {
  const facingA = facingVector(a.facing);
  const alignment = alignmentOf(a, b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const along = Math.abs(dx * facingA.x + dy * facingA.y);
  const across = Math.abs(dx * facingA.y - dy * facingA.x);
  const { faceToFaceOffset, sideBySideOffset, oppositeAlignment, sameWayAlignment } = settings.neighbors;
  if (alignment <= oppositeAlignment) return across < faceToFaceOffset * deskWidth;
  if (alignment >= sameWayAlignment) {
    return across < sideBySideOffset * deskWidth && along < faceToFaceOffset * deskWidth;
  }
  return false;
}

function findRoot(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

// Pieces that touch, joined into clusters; carpets don't join anything.
function clusterOfPiece(furniture: Furniture[], deskWidth: number, settings: EngineSettings) {
  const pieces = furniture.filter((f) => f.kind !== 'carpet');
  const outlines = pieces.map(furnitureOutline);
  const parent = pieces.map((_, i) => i);
  const touchGap = settings.neighbors.touchGap * deskWidth;
  const touching = new Set<string>();
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (outlineGap(outlines[i], outlines[j]) > touchGap) continue;
      parent[findRoot(parent, i)] = findRoot(parent, j);
      touching.add(`${pieces[i].id}|${pieces[j].id}`);
      touching.add(`${pieces[j].id}|${pieces[i].id}`);
    }
  }
  const cluster = new Map(pieces.map((piece, i) => [piece.id, findRoot(parent, i)]));
  return { cluster, touching };
}

// The usual distance from a seat to its nearest seat in this layout.
function typicalGap(seats: Seat[], deskWidth: number): number {
  if (seats.length < 2) return deskWidth;
  return median(seats.map((s) => Math.min(...seats.filter((o) => o !== s).map((o) => distance(s, o)))));
}

export function linkSeats(
  seats: Seat[],
  furniture: Furniture[],
  deskWidth: number,
  settings: EngineSettings,
): SeatLinks {
  const { cluster, touching } = clusterOfPiece(furniture, deskWidth, settings);
  const { chairGapFactor, minChairGap, maxChairGap, closeDistance } = settings.neighbors;
  const chairGap = Math.min(
    maxChairGap * deskWidth,
    Math.max(minChairGap * deskWidth, chairGapFactor * typicalGap(seats, deskWidth)),
  );

  const neighbors: number[][] = seats.map(() => []);
  const close: number[][] = seats.map(() => []);
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i];
      const b = seats[j];
      const apart = distance(a, b);
      const shareOrTouch =
        cluster.has(a.furnitureId) &&
        (a.furnitureId === b.furnitureId || touching.has(`${a.furnitureId}|${b.furnitureId}`));
      // At touching desks only face to face and side by side count, so close
      // chairs can't make diagonal or right-angle desks neighbors. Elsewhere,
      // close chairs count unless the students sit at a right angle.
      const closeChairs =
        apart <= chairGap && Math.abs(alignmentOf(a, b)) >= settings.neighbors.rightAngleAlignment;
      const isNeighbor = shareOrTouch ? sitFaceToFaceOrSideBySide(a, b, deskWidth, settings) : closeChairs;
      if (isNeighbor) {
        neighbors[i].push(j);
        neighbors[j].push(i);
      } else if (apart <= closeDistance * deskWidth) {
        close[i].push(j);
        close[j].push(i);
      }
    }
  }

  const byCluster = new Map<number, number[]>();
  seats.forEach((seat, index) => {
    const key = cluster.get(seat.furnitureId);
    if (key !== undefined) byCluster.set(key, [...(byCluster.get(key) ?? []), index]);
  });
  const { minSeats, maxSeats } = settings.groups;
  const groups = [...byCluster.values()].filter((g) => g.length >= minSeats && g.length <= maxSeats);
  const groupOf = new Int32Array(seats.length).fill(-1);
  groups.forEach((group, g) => group.forEach((seat) => (groupOf[seat] = g)));

  return { neighbors, close, groupOf, groups };
}
