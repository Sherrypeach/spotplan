/**
 * The Room step's parts, in order. The part lives in the URL (?part=…) like
 * step 1's. "How many seats" is part of Layout; doors, windows, the board and furniture are part of Shape.
 */
export const ROOM_PARTS = [
  { key: 'shape', label: 'Shape' },
  { key: 'desks', label: 'Layout' },
  { key: 'teach', label: 'Where I work' },
] as const;

/** Where the layouts are picked, e.g. from the Seats step. */
export const DESKS_PART_PATH = '/room?part=desks';
/** Where doors and windows are added. */
export const SHAPE_PART_PATH = '/room?part=shape';

export type RoomPartKey = (typeof ROOM_PARTS)[number]['key'];

export function isRoomPartKey(value: string | null): value is RoomPartKey {
  return ROOM_PARTS.some((part) => part.key === value);
}
