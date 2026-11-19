import type { ColorTag } from '@modules/classroom/document';
import type { Level } from '@modules/seating/engine/types';

// The tags' starting names, so "Noah, 3, blue" works before the teacher renames them.
const DEFAULT_TAG_NAMES = ['pink', 'orange', 'blue', 'purple'];

// Levels are colored red, yellow and green, so those words alone mean a level.
const LEVEL_WORDS: Record<string, Level> = { red: 1, yellow: 2, green: 3 };

// One level written any of these ways: "1", "(1)", "[1]", "L1", "lvl 1",
// "level: 1", "Level 1". A lone "L" only counts touching the digit ("L2"), so a
// last initial ("Ben L 2") isn't taken for part of a level.
const LEVEL = String.raw`[([{]?\s*(?:(?:level|lvl|lv)\s*[:#.]?\s*|l)?([123])\s*[)\]}]?`;
const LEVEL_ONLY = new RegExp(`^${LEVEL}$`, 'i');
const LEVEL_AT_END = new RegExp(`\\s${LEVEL}$`, 'i');
const LEVEL_AT_START = new RegExp(`^${LEVEL}\\s+(?=\\p{L})`, 'iu');
// A level in brackets anywhere in a name: "Ben (2) Cruz".
const LEVEL_IN_BRACKETS = /\s[([]\s*([123])\s*[)\]]\s/;

// An email, written so no part can match the same characters two ways (that
// would make long junk input take seconds to check).
const EMAIL = /[^\s@<>(),;]+@(?:[^\s@<>(),;.]+\.)+[^\s@<>(),;.]+/;
const EMAIL_ALL = new RegExp(`<?${EMAIL.source}>?`, 'g');
// Numbers that aren't levels: IDs ("104522", "S-1042", "#12"), phone numbers, dates.
const OTHER_NUMBER = /^(?:[#(]?\d[\d./-]*\)?|[A-Za-z]{1,3}[-#]?\d{3,})$/;
// Class details that aren't part of a name: "Grade 3", "Room 12", "Period 2", "4th grade".
const CLASS_DETAIL = /^(?:(?:grade|gr|room|rm|period|per|homeroom|hr|class|section|sec)\.?\s*#?\s*\w*\d\w*|\d+(?:st|nd|rd|th)\s+grade)$/i;
const CLASS_DETAIL_AT_END = /\s(?:(?:grade|gr|room|rm|period|per|homeroom|hr|section|sec)\.?\s*#?\s*\w*\d\w*|\d+(?:st|nd|rd|th)\s+grade)$/i;

/** A level (1, 2, 3) written on its own in a cell, or null. */
export function readLevel(raw: string): Level | null {
  const value = raw.trim().toLowerCase();
  if (value in LEVEL_WORDS) return LEVEL_WORDS[value];
  const match = value.match(LEVEL_ONLY);
  return match ? (Number(match[1]) as Level) : null;
}

/** A color tag the teacher named (exactly), or null. Checked before level words. */
export function readOwnColor(raw: string, tags: ColorTag[]): number | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  const index = tags.findIndex((tag) => tag.name.trim().toLowerCase() === value);
  return index >= 0 ? index : null;
}

/** A color by its tag name (as renamed by the teacher) or its starting name. */
export function readColor(raw: string, tags: ColorTag[]): number | null {
  const own = readOwnColor(raw, tags);
  if (own !== null) return own;
  const byDefault = DEFAULT_TAG_NAMES.indexOf(raw.trim().toLowerCase());
  return byDefault >= 0 ? byDefault : null;
}

export function isEmailOnly(raw: string): boolean {
  const value = raw.trim().replace(/^<|>$/g, '');
  return EMAIL.test(value) && value.replace(EMAIL, '').trim() === '';
}

/** A cell that's a number but not a level, or a class detail like "Grade 3". */
export function isNotAName(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return (OTHER_NUMBER.test(value) && readLevel(value) === null) || CLASS_DETAIL.test(value);
}

/** "ava.rossi@school.org" → "ava rossi" (cleanName fixes the capitals). */
export function nameFromEmail(raw: string): string {
  const local = raw.trim().replace(/^<|>$/g, '').split('@')[0];
  return local.replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim();
}

/**
 * Takes the extras out of one name: emails, ID numbers, class details, and a
 * level written before, after or in brackets inside it.
 */
export function splitName(raw: string): { text: string; level: Level | null } {
  let text = ` ${raw.replace(EMAIL_ALL, ' ')} `.replace(/\s+/g, ' ');
  text = text
    .trim()
    .split(' ')
    .filter((word) => !(OTHER_NUMBER.test(word) && readLevel(word) === null))
    .join(' ');
  text = text.replace(CLASS_DETAIL_AT_END, '');

  const inBrackets = ` ${text} `.match(LEVEL_IN_BRACKETS);
  if (inBrackets) {
    return { text: ` ${text} `.replace(LEVEL_IN_BRACKETS, ' ').trim(), level: Number(inBrackets[1]) as Level };
  }
  const atEnd = text.match(LEVEL_AT_END);
  if (atEnd) return { text: text.slice(0, atEnd.index), level: Number(atEnd[1]) as Level };
  const atStart = text.match(LEVEL_AT_START);
  if (atStart) return { text: text.slice(atStart[0].length), level: Number(atStart[1]) as Level };
  // "red", "yellow" and "green" only count in a cell of their own: "Ava Green" is a surname.
  return { text, level: null };
}
