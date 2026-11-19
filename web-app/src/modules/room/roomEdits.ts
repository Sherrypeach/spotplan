import type { ClassroomDocument, DocRoom, RoomCorner } from '@modules/classroom/document';
import { isFurniture, keepFurnitureInside } from '@modules/room/furniture';
import { keepGroupsInside } from '@modules/room/roomGroups';
import { isWallFeature, keepFeaturesOnWalls } from '@modules/room/wallFeatures';
import { clampFeet, fromFeet, toFeet, UNITS_PER_FOOT } from '@modules/room/units';

// The L-shape's missing corner stays between these shares of each side.
const MIN_CUT_SHARE = 0.1;
const MAX_CUT_SHARE = 0.7;
const DEFAULT_CUT_SHARE = 1 / 3;

// Any change to the walls pulls the tables back onto the floor, out of an L's missing corner
// too, keeps doors and windows on their walls, and furniture with its teacher spot on the floor.
function withRoom(doc: ClassroomDocument, room: DocRoom): ClassroomDocument {
  return { ...doc, room: keepFurnitureInside(keepGroupsInside(keepFeaturesOnWalls(room))) };
}

function cutSize(side: number, share: number): number {
  return Math.round(side * Math.min(MAX_CUT_SHARE, Math.max(MIN_CUT_SHARE, share)));
}

/** Rectangle or L-shape. An L starts with the back-right corner missing, a third of each side. */
export function setRoomShape(doc: ClassroomDocument, shape: 'rectangle' | 'l-shape'): ClassroomDocument {
  const { room } = doc;
  if (shape === 'rectangle') {
    const rectangle: DocRoom = { ...room, shape: 'rectangle' };
    delete rectangle.cutCorner;
    delete rectangle.cutWidth;
    delete rectangle.cutDepth;
    return withRoom(doc, rectangle);
  }
  return withRoom(doc, {
    ...room,
    shape: 'l-shape',
    cutCorner: room.cutCorner ?? 'bottom-right',
    cutWidth: room.cutWidth ?? cutSize(room.width, DEFAULT_CUT_SHARE),
    cutDepth: room.cutDepth ?? cutSize(room.depth, DEFAULT_CUT_SHARE),
  });
}

type Resize = { width?: number; depth?: number; fromLeft?: boolean; fromTop?: boolean };

/**
 * The room at a new size in feet. When the left or front wall moved, what's
 * inside moves with it, so furniture keeps its place against the far walls.
 * The missing corner keeps its size (within its limits), and every table
 * stays inside as one block, chairs and all.
 */
export function resizedRoom(room: DocRoom, size: Resize): DocRoom {
  const width = size.width === undefined ? room.width : fromFeet(clampFeet(size.width));
  const depth = size.depth === undefined ? room.depth : fromFeet(clampFeet(size.depth));
  const dx = size.fromLeft ? width - room.width : 0;
  const dy = size.fromTop ? depth - room.depth : 0;
  const moved = <T extends { x: number; y: number }>(item: T): T => ({ ...item, x: item.x + dx, y: item.y + dy });
  const resized: DocRoom = {
    ...room,
    width,
    depth,
    pieces: dx || dy ? room.pieces.map(moved) : room.pieces,
    seats: dx || dy ? room.seats.map(moved) : room.seats,
    spots: dx || dy ? room.spots.map(moved) : room.spots,
    // Layouts set aside move too, so they come back where they were left.
    savedLayouts:
      (dx || dy) && room.savedLayouts
        ? Object.fromEntries(
            Object.entries(room.savedLayouts).map(([id, saved]) => [id, { ...saved, pieces: saved.pieces.map(moved), seats: saved.seats.map(moved) }]),
          )
        : room.savedLayouts,
  };
  if (room.shape === 'l-shape' && room.cutWidth !== undefined && room.cutDepth !== undefined) {
    resized.cutWidth = cutSize(width, room.cutWidth / width);
    resized.cutDepth = cutSize(depth, room.cutDepth / depth);
  }
  return keepFurnitureInside(keepGroupsInside(keepFeaturesOnWalls(resized)));
}

/** Sets the room's size in feet (side to side, front to back). */
export function setRoomFeet(doc: ClassroomDocument, size: Resize): ClassroomDocument {
  return withRoom(doc, resizedRoom(doc.room, size));
}

export function setCutCorner(doc: ClassroomDocument, corner: RoomCorner): ClassroomDocument {
  return withRoom(doc, { ...doc.room, cutCorner: corner });
}

/** Sets the missing corner's size in feet, kept between 10% and 70% of each side. */
export function setCutFeet(doc: ClassroomDocument, size: { width?: number; depth?: number }): ClassroomDocument {
  const { room } = doc;
  const width = size.width === undefined ? room.cutWidth : cutSize(room.width, fromFeet(size.width) / room.width);
  const depth = size.depth === undefined ? room.cutDepth : cutSize(room.depth, fromFeet(size.depth) / room.depth);
  return withRoom(doc, { ...room, cutWidth: width, cutDepth: depth });
}

/** The smallest and largest missing corner, in feet, for one side. */
export function cutFeetRange(side: number): { min: number; max: number } {
  return {
    min: Math.max(1, Math.ceil((side * MIN_CUT_SHARE) / UNITS_PER_FOOT)),
    max: Math.floor((side * MAX_CUT_SHARE) / UNITS_PER_FOOT),
  };
}

/** One line for the folded pill and screen readers: "Rectangle · 30 × 24 ft". */
export function shapeSummary(room: DocRoom): string {
  const size = `${toFeet(room.width)} × ${toFeet(room.depth)} ft`;
  return room.shape === 'l-shape' ? `L-shaped · ${size}` : `Rectangle · ${size}`;
}

// A new room: 30 by 24 ft, the same as a new class gets.
const DEFAULT_WIDTH_FEET = 30;
const DEFAULT_DEPTH_FEET = 24;

/** The room back to the start, an empty 30 × 24 ft rectangle, keeping its doors, windows and the teacher's furniture. */
export function resetRoom(room: DocRoom): DocRoom {
  // The teacher's own furniture stays, with the spots tied to it, moved inside the new walls if it has to.
  const kept = new Set(room.pieces.filter((piece) => isWallFeature(piece) || isFurniture(piece)).map((piece) => piece.id));
  const cleared = keepFeaturesOnWalls({
    shape: 'rectangle',
    width: fromFeet(DEFAULT_WIDTH_FEET),
    depth: fromFeet(DEFAULT_DEPTH_FEET),
    pieces: room.pieces.filter((piece) => kept.has(piece.id)),
    layout: null,
    seats: [],
    spots: room.spots.filter((spot) => spot.pieceId !== undefined && kept.has(spot.pieceId)),
    labels: {},
    handSetLabels: [],
    locked: false,
    savedLayouts: {},
    // The board stays on its wall, like the doors and windows.
    ...(room.front ? { front: room.front } : {}),
  });
  return keepFurnitureInside(cleared);
}
