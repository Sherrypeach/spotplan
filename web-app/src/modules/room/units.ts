import { UNITS_PER_DESK } from '@modules/seating/engine/settings';

// The room is stored in drawing units, where a desk is UNITS_PER_DESK wide. A
// classroom desk is about 2 feet wide, so a foot is half a desk. Teachers
// only ever see feet; the layouts are scaled to fit the walls, so these feet
// set the room's proportions and labels more than real distances.
export const UNITS_PER_FOOT = UNITS_PER_DESK / 2;

export const MIN_FEET = 10;
export const MAX_FEET = 80;

export function toFeet(units: number): number {
  return Math.round(units / UNITS_PER_FOOT);
}

export function fromFeet(feet: number): number {
  return Math.round(feet * UNITS_PER_FOOT);
}

export function clampFeet(feet: number, min = MIN_FEET, max = MAX_FEET): number {
  return Math.min(max, Math.max(min, Math.round(feet)));
}
