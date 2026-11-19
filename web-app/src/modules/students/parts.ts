/**
 * Step 1's parts, in order. The part lives in the URL (?part=…) so the
 * browser's back button and links from other steps land on the right one.
 */
export const PARTS = [
  { key: 'names', label: 'Names' },
  { key: 'support', label: 'Extra support' },
  { key: 'anywhere', label: 'Sit anywhere' },
  { key: 'check', label: 'Check' },
  { key: 'extras', label: 'Anything else?' },
] as const;

export type PartKey = (typeof PARTS)[number]['key'];

/** Where "Change a student's level" on later steps leads. */
export const CHECK_PART_PATH = '/students?part=check';
export const NAMES_PART_PATH = '/students?part=names';

export function isPartKey(value: string | null): value is PartKey {
  return PARTS.some((part) => part.key === value);
}

/** Where step 1 opens: adding names for an empty class, the baskets otherwise. */
export function defaultPart(studentCount: number): PartKey {
  return studentCount === 0 ? 'names' : 'check';
}

/** What later steps hand over, so the baskets can offer a way back. */
export type ReturnState = { returnTo?: string };

export function readReturnTo(state: unknown): string | undefined {
  const returnTo = (state as ReturnState | null)?.returnTo;
  return typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;
}
