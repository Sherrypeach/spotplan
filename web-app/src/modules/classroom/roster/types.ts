import type { Level } from '@modules/seating/engine/types';

/** One student as read from a pasted list or a file, before it joins the class. */
export type RosterEntry = { name: string; level: Level | null; color: number | null };
