import type { ColorTag } from '@modules/classroom/document';
import { readColor, readLevel, splitName } from '@modules/classroom/roster/cells';
import { countsUp, isHeading, MAX_LINE_LENGTH, parseLine } from '@modules/classroom/roster/lines';
import { cleanName, lastFirst } from '@modules/classroom/roster/names';
import type { RosterEntry } from '@modules/classroom/roster/types';

// The header row can sit below a title row or two ("Room 12 – Ms. Lee").
const HEADER_SEARCH_ROWS = 5;
// Columns that hold numbers, not names, even when they say "employee": "Employee #", "Employee ID".
const NUMBER_COLUMN = /#|\bid\b|\bno\.|number|num\b/i;

// Column headers we recognize, in lower case, with punctuation and extra spaces removed.
const HEADERS = {
  name: [
    'name',
    'names',
    'student',
    'students',
    'student name',
    'student names',
    'students names',
    'students name',
    'full name',
    'student full name',
    'pupil',
    'pupils',
    'pupil name',
    'child',
    'child name',
    'teammate',
    'teammates',
    'teammate name',
    'teammate names',
    'teammates name',
    'teammates names',
    'teammate full name',
    'employee',
    'employees',
    'employee name',
    'employee full name',
    'staff name',
    'empleado',
    'empleados',
    'nombre',
    'nombre completo',
    'alumno',
    'alumnos',
    'estudiante',
    'estudiantes',
  ],
  lastFirstName: ['last name first name', 'last first', 'name last first', 'lastname firstname'],
  first: ['first name', 'first', 'firstname', 'given name', 'given', 'student first name', 'teammate first name', 'employee first name', 'nombre de pila', 'nombres'],
  preferred: ['preferred name', 'preferred first name', 'nickname', 'goes by', 'apodo'],
  last: ['last name', 'last', 'lastname', 'surname', 'family name', 'student last name', 'teammate last name', 'employee last name', 'apellido', 'apellidos'],
  level: ['level', 'levels', 'student level', 'teammate level', 'employee level', 'seating level', 'nivel'],
  color: ['color', 'colour', 'color tag', 'tag', 'group'],
};

function headerKey(cell: string): string {
  return cell
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function columnOf(header: string[], names: string[]): number {
  return header.findIndex((cell) => !NUMBER_COLUMN.test(cell) && names.includes(headerKey(cell)));
}

type Columns = Record<keyof typeof HEADERS, number>;

function findColumns(header: string[]): Columns | null {
  const columns = Object.fromEntries(
    Object.entries(HEADERS).map(([key, names]) => [key, columnOf(header, names)]),
  ) as Columns;
  const hasName = columns.name >= 0 || columns.first >= 0 || columns.lastFirstName >= 0 || columns.preferred >= 0;
  return hasName ? columns : null;
}

// Lines looked at to pick the delimiter: enough to get past a title line or two.
const DELIMITER_SAMPLE_LINES = 5;

/** Picks the delimiter a spreadsheet file uses: tab, semicolon (European Excel) or comma. */
export function detectDelimiter(text: string): string {
  const sample = text
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, DELIMITER_SAMPLE_LINES);
  // The busiest line decides, so a title line above the header ("Room 12") doesn't.
  const counts = ['\t', ';', ','].map((delimiter) => ({
    delimiter,
    count: Math.max(0, ...sample.map((line) => line.split(delimiter).length - 1)),
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ',';
}

/** Splits delimited text into rows of cells, honoring quoted cells with delimiters or quotes in them. */
export function splitDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((c) => c.trim()));
}

function entryFromColumns(cells: string[], columns: Columns, tags: ColorTag[]): RosterEntry | null {
  const cell = (index: number) => (index >= 0 ? (cells[index] ?? '').slice(0, MAX_LINE_LENGTH).trim() : '');
  let whole: string;
  if (columns.lastFirstName >= 0) {
    const [last, first] = cell(columns.lastFirstName).split(',');
    whole = first ? lastFirst(last, first) : last;
  } else if (columns.preferred >= 0 && cell(columns.preferred)) {
    whole = `${cell(columns.preferred)} ${cell(columns.last)}`;
  } else if (columns.first >= 0) {
    whole = `${cell(columns.first)} ${cell(columns.last)}`;
  } else {
    // A single name column may hold "Rossi, Ava" (last name first), or only
    // the first name when there's also a last name column ("Nombre", "Apellido").
    const [last, first] = cell(columns.name).split(',');
    if (first) whole = lastFirst(last, first);
    else whole = `${last} ${cell(columns.last)}`;
  }
  // A level can also sit in the name cell ("Ava Rossi (2)"); the Level column wins.
  const split = splitName(whole);
  const name = cleanName(split.text);
  if (!name) return null;
  return { name, level: readLevel(cell(columns.level)) ?? split.level, color: readColor(cell(columns.color), tags) };
}

function filledCount(cells: string[]): number {
  return cells.filter((cell) => cell.trim()).length;
}

/** A row of column titles or a heading ("Students", "Name | Level"), never a student. */
function isHeaderRow(cells: string[]): boolean {
  const known = new Set(Object.values(HEADERS).flat());
  return cells.filter((cell) => cell.trim()).every((cell) => known.has(headerKey(cell)) || isHeading(cell));
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => !cell.trim());
}

/** The header row and its columns, if one of the first rows is a header. */
export function findHeader(rows: string[][]): { index: number; columns: Columns } | null {
  const candidates = rows.slice(0, HEADER_SEARCH_ROWS);
  for (let index = 0; index < candidates.length; index++) {
    // A lone heading cell ("Students") above rows of several cells isn't a header row.
    const below = rows.slice(index + 1, index + 1 + HEADER_SEARCH_ROWS);
    const widest = Math.max(0, ...below.map(filledCount));
    if (filledCount(candidates[index]) < Math.min(widest, 2)) continue;
    const columns = findColumns(candidates[index]);
    if (columns) return { index, columns };
  }
  return null;
}

/** True when some column after the first holds only level or color words ("red", "green", a tag's name). */
function hasWordColumn(rows: string[][], tags: ColorTag[]): boolean {
  const width = Math.max(0, ...rows.map((cells) => cells.length));
  for (let column = 1; column < width; column++) {
    const values = rows.map((cells) => (cells[column] ?? '').trim()).filter(Boolean);
    const allWords = values.every((value) => !/\d/.test(value) && (readLevel(value) !== null || readColor(value, tags) !== null));
    if (values.length > 0 && allWords) return true;
  }
  return false;
}

/** One cell holding "Rossi, Ava" (last name first) becomes "Ava Rossi". */
function flipLastFirst(cell: string): string {
  const match = cell.trim().match(/^([^,]+),\s*([^,]+)$/);
  return match ? lastFirst(match[1].trim(), match[2].trim()) : cell;
}

/**
 * Rows from a spreadsheet (a file, or cells pasted from Sheets or Excel).
 * With a header row (found in the first few rows), columns are found by name
 * in any order and the rest are ignored (IDs, emails, grades). Without one,
 * name cells side by side are first and last name, and a row number in front
 * of every row is dropped.
 */
export function parseRosterTable(rows: string[][], tags: ColorTag[]): RosterEntry[] {
  const filled = rows.filter((cells) => !isEmptyRow(cells));
  if (filled.length === 0) return [];
  const header = findHeader(filled);
  if (header) {
    return filled
      .slice(header.index + 1)
      .map((cells) => entryFromColumns(cells, header.columns, tags))
      .filter((entry): entry is RosterEntry => entry !== null);
  }
  const students = filled.filter((cells) => !isHeaderRow(cells));
  const lines = students.map((cells) => cells.map(flipLastFirst).join('\t'));
  const counted = countsUp(lines);
  // "Green" is a level only when it sits in a column of nothing but levels or colors.
  const wordsAreNames = !hasWordColumn(students, tags);
  return lines
    .map((line) => parseLine(line, { tags, counted, lastNameFirst: false, wordsAreNames }))
    .filter((entry): entry is RosterEntry => entry !== null);
}
