import type { ColorTag } from '@modules/classroom/document';
import { isEmailOnly, isNotAName, readColor, readLevel } from '@modules/classroom/roster/cells';
import { countsUp, hasTwoNameCells, isHeading, MAX_LINE_LENGTH, parseLine, readCells, tidyLine } from '@modules/classroom/roster/lines';
import { normalizeText, SUFFIXES } from '@modules/classroom/roster/names';
import { parseRosterTable } from '@modules/classroom/roster/table';
import type { RosterEntry } from '@modules/classroom/roster/types';

export type { RosterEntry } from '@modules/classroom/roster/types';
export { firstNamesOnly } from '@modules/classroom/roster/names';

// Longer pastes are cut: a class holds at most 60, so this is plenty and keeps typing fast.
export const MAX_PASTE_LENGTH = 20_000;
// Share of lines with two names ("Rossi, Ava") that marks the list as last name first.
const LAST_NAME_FIRST_SHARE = 0.6;
// A single line with at least this many names separated by commas is a list of names.
const MIN_NAMES_ON_ONE_LINE = 3;

/** "Ava, Ben, Chloe, Diego" on one line: several plain names, no levels, numbers or suffixes. */
function namesOnOneLine(line: string, tags: ColorTag[]): string[] | null {
  const separator = line.includes(';') ? ';' : ',';
  const parts = line
    .split(separator)
    .map((part) => part.slice(0, MAX_LINE_LENGTH).trim())
    .filter(Boolean);
  if (parts.length < MIN_NAMES_ON_ONE_LINE) return null;
  const allNames = parts.every(
    (part) =>
      /\p{L}/u.test(part) &&
      !/\d/.test(part) &&
      !SUFFIXES.has(part.toLowerCase()) &&
      readLevel(part) === null &&
      readColor(part, tags) === null &&
      !isEmailOnly(part) &&
      !isNotAName(part),
  );
  return allNames ? parts : null;
}

/** Google Classroom and email lists put each email on its own line, next to the name. */
function dropEmailLines(lines: string[]): string[] {
  const emailLines = lines.filter((line) => isEmailOnly(tidyLine(line)));
  if (emailLines.length === 0 || emailLines.length === lines.length) return lines;
  return lines.filter((line) => !isEmailOnly(tidyLine(line)));
}

/** Most lines are "Last, First" (school systems export names that way). */
function isLastNameFirst(lines: string[], tags: ColorTag[], counted: boolean): boolean {
  const withTwoNames = lines.filter((line) =>
    hasTwoNameCells(readCells(line, { tags, counted, lastNameFirst: false })),
  ).length;
  if (lines.length === 1) return withTwoNames === 1;
  return withTwoNames / lines.length >= LAST_NAME_FIRST_SHARE;
}

/**
 * Turns whatever a teacher pastes into students. It understands, among others:
 * one name per line, a level before, after or inside the name ("1 Ava",
 * "Ava 1", "Ava, 1", "Ava (1)", "Ava - level 1", "Ava, red"), a color tag
 * after it, numbered and bulleted lists, "Last, First", headings, emails (from
 * Google Classroom or alone), student ID numbers and class details, ALL CAPS,
 * nicknames ("Alexander (Alex) Smith"), several names on one line ("Ava, Ben,
 * Chloe"), and cells copied from Sheets or Excel, with or without a header row.
 */
export function parseRosterText(text: string, tags: ColorTag[]): RosterEntry[] {
  const lines = normalizeText(text.slice(0, MAX_PASTE_LENGTH))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  if (lines.some((line) => line.includes('\t'))) {
    return parseRosterTable(
      lines.map((line) => line.split('\t')),
      tags,
    );
  }

  const expanded = lines.flatMap((line) => namesOnOneLine(line, tags) ?? [line]);
  const students = dropEmailLines(expanded.filter((line) => !isHeading(line)));
  const counted = countsUp(students);
  const options = { tags, counted, lastNameFirst: isLastNameFirst(students, tags, counted) };
  return students.map((line) => parseLine(line, options)).filter((entry): entry is RosterEntry => entry !== null);
}
