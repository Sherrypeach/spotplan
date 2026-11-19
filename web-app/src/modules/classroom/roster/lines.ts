import type { ColorTag } from '@modules/classroom/document';
import {
  isEmailOnly,
  isNotAName,
  nameFromEmail,
  readColor,
  readLevel,
  readOwnColor,
  splitName,
} from '@modules/classroom/roster/cells';
import { cleanName, lastFirst, SUFFIXES } from '@modules/classroom/roster/names';
import type { RosterEntry } from '@modules/classroom/roster/types';
import type { Level } from '@modules/seating/engine/types';

// No roster line is this long; cutting longer ones keeps odd pastes fast.
export const MAX_LINE_LENGTH = 200;

// Bullets and check boxes in front of a name: "• Ava", "- Ava", "☐ Ava".
const BULLET = /^[•·\-*–—◦▪▫►▸‣⁃○●■□☐☑✓✔→>]+\s*/u;
// A list number: "1.", "1)", "#1". Followed by the name.
const LIST_NUMBER = /^(?:#\d+|\d+[.)])\s*/;
// A plain number in front ("1 Ava", "(1) Ava"): a list number only when the
// whole list counts up 1, 2, 3…; otherwise it may be a level.
const BARE_NUMBER = /^\(?(\d+)\)?\s*[,:\-–]?\s*/;
// Where a name ends and a level or color begins: commas, semicolons, tabs, bars, " - ".
const CELL_BREAK = /[,;\t|]| [-–—] /;
// The same, captured, so we know which separator came before each cell.
const CELL_BREAK_KEPT = /([,;\t|]| [-–—] )/;
// Lines that are a heading, not a student.
const HEADING = /^(?:(?:student|teammate|employee)\s+)?(?:names?|students?|teammates?|employees?|staff|class\s*(?:list|roster)?|team\s*(?:list|roster)?|staff\s*list|employee\s*list|roster|first\s+name.*|last\s+name.*|nombres?|alumnos?|estudiantes?)\s*:?$/i;
// A name-like cell: one to three words of letters (with hyphens, apostrophes, initials).
const NAME_LIKE = /^[\p{L}'’.-]+(?: [\p{L}'’.-]+){0,2}$/u;

/** One pasted line, trimmed, with bullets gone and very long lines cut. */
export function tidyLine(line: string): string {
  return line.trim().slice(0, MAX_LINE_LENGTH).replace(BULLET, '').trim();
}

export function isHeading(line: string): boolean {
  return HEADING.test(tidyLine(line));
}

/** True when every line starts with 1, 2, 3, 4… in order: those numbers count students. */
export function countsUp(lines: string[]): boolean {
  if (lines.length < 2) return false;
  return lines.every((line, index) => {
    const match = tidyLine(line).match(/^[#(]?(\d+)/);
    return Number(match?.[1]) === index + 1;
  });
}

type LineOptions = {
  tags: ColorTag[];
  /** The list is numbered 1, 2, 3…: drop the plain number in front of each line. */
  counted: boolean;
  /** Two names on a line ("Rossi, Ava") are last name first; otherwise first name first. */
  lastNameFirst: boolean;
  /**
   * Words like "Green" or a tag's name are names, not levels or colors: for
   * spreadsheet rows with no column of only such words.
   */
  wordsAreNames?: boolean;
};

type Cells = {
  names: string[];
  level: Level | null;
  color: number | null;
  /** "Jr." or "III" in a cell of its own: "Smith, John, III". */
  suffix: string | null;
  /** The first two name cells were split by a comma: "Rossi, Ava". */
  commaBetweenNames: boolean;
};

/** Splits a line into its name cells and whatever level and color it carries. */
export function readCells(line: string, options: LineOptions): Cells {
  const tidy = tidyLine(line);
  let rest = tidy.replace(LIST_NUMBER, '');
  // Only one list number per line: in "1) 3 Ava" the 3 is a level.
  if (options.counted && rest === tidy) rest = rest.replace(BARE_NUMBER, '');

  let level: Level | null = null;
  let color: number | null = null;
  let suffix: string | null = null;
  let commaBetweenNames = false;
  const names: string[] = [];
  const parts = rest.split(CELL_BREAK_KEPT);
  for (let index = 0; index < parts.length; index += 2) {
    const trimmed = parts[index].trim();
    if (!trimmed) continue;
    // A word before any name is a name ("Green, Ava" is Ava Green), and so is
    // every word when the options say so; numbers are always levels.
    const readsWords = names.length > 0 && !options.wordsAreNames;
    const wordOnly = !/\d/.test(trimmed);
    // A tag the teacher named "Green" is a color tag, not level 3.
    const ownColor = wordOnly && !readsWords ? null : readOwnColor(trimmed, options.tags);
    const cellLevel = ownColor === null && (readsWords || !wordOnly) ? readLevel(trimmed) : null;
    const cellColor = ownColor ?? (readsWords ? readColor(trimmed, options.tags) : null);
    if (SUFFIXES.has(trimmed.toLowerCase()) && names.length > 0) suffix = suffix ?? trimmed;
    else if (cellLevel !== null) level = level ?? cellLevel;
    else if (cellColor !== null) color = color ?? cellColor;
    else if (isEmailOnly(trimmed) || isNotAName(trimmed)) continue;
    else {
      if (names.length === 1) commaBetweenNames = parts[index - 1]?.trim() === ',';
      names.push(trimmed);
    }
  }
  return { names, level, color, suffix, commaBetweenNames };
}

/** Two cells that each look like part of a name: "Rossi" and "Ava M." (or "Ava 1", with its level). */
export function hasTwoNameCells(cells: Cells): boolean {
  return cells.names.length === 2 && cells.names.every((name) => NAME_LIKE.test(splitName(name).text.trim()));
}

/** One pasted line as a student, or null when there's no name in it. */
export function parseLine(line: string, options: LineOptions): RosterEntry | null {
  const cells = readCells(line, options);
  // A level can also sit inside a name cell: "Rossi, Ava 1", "1 Ava".
  const parts = cells.names.map(splitName);
  const levelInside = parts.find((part) => part.level !== null)?.level ?? null;
  const texts = parts.map((part) => part.text).filter((text) => text.trim());

  let raw: string;
  if (texts.length === 0) {
    // A line that's only an email still names the student: "ava.rossi@school.org".
    const email = tidyLine(line)
      .split(CELL_BREAK)
      .find((cell) => isEmailOnly(cell));
    raw = email ? nameFromEmail(email) : '';
  } else if (texts.length >= 2) {
    // A comma between two names means last name first on any line ("Cruz, Ben"),
    // even in a list where most lines are first name first.
    const lastNameFirst = options.lastNameFirst || cells.commaBetweenNames;
    raw = lastNameFirst ? lastFirst(texts[0], texts[1]) : `${texts[0]} ${texts[1]}`;
  } else {
    raw = texts[0];
  }

  const name = cleanName(cells.suffix && raw ? `${raw} ${cells.suffix}` : raw);
  if (!name) return null;
  return { name, level: cells.level ?? levelInside, color: cells.color };
}
