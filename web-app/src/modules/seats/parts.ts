/** The Seats step's parts, in order; the part lives in the URL (?part=…) like the other steps'. */
export const SEAT_PARTS = [
  { key: 'labels', label: 'Labels' },
  { key: 'students', label: 'Place teammates' },
  { key: 'check', label: 'Check' },
] as const;

export type SeatPartKey = (typeof SEAT_PARTS)[number]['key'];

export function isSeatPartKey(value: string | null): value is SeatPartKey {
  return SEAT_PARTS.some((part) => part.key === value);
}

/** Where the class is seated, e.g. from the Chart step. */
export const SEAT_STUDENTS_PART_PATH = '/seats?part=students';
