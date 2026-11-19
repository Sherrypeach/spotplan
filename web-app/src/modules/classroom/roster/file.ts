import type { ColorTag } from '@modules/classroom/document';
import { normalizeText } from '@modules/classroom/roster/names';
import { detectDelimiter, findHeader, parseRosterTable, splitDelimited } from '@modules/classroom/roster/table';
import type { RosterEntry } from '@modules/classroom/roster/types';
import { parseRosterText } from '@modules/classroom/rosterImport';

/** What a teacher can upload; anything else gets a plain message. */
export const ROSTER_FILE_TYPES = '.csv,.tsv,.txt,.xlsx,text/csv,text/plain,text/tab-separated-values';

// A class roster is a few kilobytes; anything this big isn't one, and reading it could freeze the page.
const MAX_FILE_BYTES = 2 * 1024 * 1024;
// Excel files (and other Office files) are zip archives, which start with these bytes.
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const EXCEL_EXTENSIONS = ['.xlsx', '.xlsm'];
// Files people might try that hold a list but that we can't read directly.
const OTHER_DOCUMENTS = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.pages', '.numbers', '.ods', '.xlsb', '.png', '.jpg', '.jpeg', '.heic'];
const CANT_READ = 'We can’t read that kind of file. Copy the names from it and paste them in the notebook instead.';

export class RosterFileError extends Error {}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/** UTF-16 text has a NUL byte in every other position (English letters are one byte plus zero). */
function looksLikeUtf16(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const sample = bytes.subarray(0, 200);
  let evenZeros = 0;
  let oddZeros = 0;
  for (let index = 0; index < sample.length; index++) {
    if (sample[index] !== 0) continue;
    if (index % 2 === 0) evenZeros++;
    else oddZeros++;
  }
  const half = sample.length / 2;
  if (oddZeros > half * 0.4 && evenZeros < half * 0.1) return 'utf-16le';
  if (evenZeros > half * 0.4 && oddZeros < half * 0.1) return 'utf-16be';
  return null;
}

/**
 * Reads a text file in whatever encoding Excel saved it: UTF-8, UTF-16
 * ("Unicode Text", with or without its marker) or Windows-1252 (older Excel,
 * where "Fernández" would otherwise come out garbled).
 */
export function decodeText(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  const utf16 = looksLikeUtf16(bytes);
  if (utf16) return new TextDecoder(utf16).decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function cellsAsText(rows: unknown[][]): string[][] {
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
}

/** The sheet that holds the roster: the first with a header row, or else the fullest. */
function pickSheet(sheets: string[][][]): string[][] {
  const withHeader = sheets.find((rows) => findHeader(rows.filter((cells) => cells.some((cell) => cell.trim()))));
  if (withHeader) return withHeader;
  return sheets.reduce((fullest, rows) => (rows.length > fullest.length ? rows : fullest), [] as string[][]);
}

async function readExcel(file: File): Promise<string[][]> {
  // Loaded only when someone uploads an Excel file, to keep the app small.
  let readXlsxFile: typeof import('read-excel-file/browser').default;
  try {
    readXlsxFile = (await import('read-excel-file/browser')).default;
  } catch {
    throw new RosterFileError('We couldn’t open the Excel reader. Check your connection and try again.');
  }
  try {
    const sheets = await readXlsxFile(file);
    return pickSheet(sheets.map((sheet) => cellsAsText(sheet.data)));
  } catch {
    throw new RosterFileError('We couldn’t open that Excel file. Try saving it again, or as CSV.');
  }
}

/** Students from an uploaded file: Excel (.xlsx), CSV (comma or semicolon), TSV or plain text. */
export async function readRosterFile(file: File, tags: ColorTag[]): Promise<RosterEntry[]> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_FILE_BYTES) {
    throw new RosterFileError('That file is too big to be a team list. Pick the file with just your team in it.');
  }
  if (name.endsWith('.xls')) {
    throw new RosterFileError('That’s an old Excel file (.xls). Open it in Excel or Google Sheets and save it as .xlsx or CSV.');
  }
  if (OTHER_DOCUMENTS.some((extension) => name.endsWith(extension))) throw new RosterFileError(CANT_READ);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // An Excel file renamed to .csv, or saved without an extension, is still read as Excel.
  if (EXCEL_EXTENSIONS.some((extension) => name.endsWith(extension)) || startsWith(bytes, ZIP_SIGNATURE)) {
    return parseRosterTable(await readExcel(file), tags);
  }

  const decoded = decodeText(bytes);
  // Text full of NUL bytes is some other binary file.
  if (decoded.split('\u0000').length - 1 > decoded.length / 20) throw new RosterFileError(CANT_READ);
  const text = normalizeText(decoded);
  if (name.endsWith('.txt') || !(name.endsWith('.csv') || name.endsWith('.tsv'))) {
    return parseRosterText(text, tags);
  }
  // A spreadsheet file: a header row decides the columns; without one, a
  // comma or semicolon file reads exactly like the same lines pasted in.
  const delimiter = detectDelimiter(text);
  const rows = splitDelimited(text, delimiter);
  if (findHeader(rows) || delimiter === '\t') return parseRosterTable(rows, tags);
  return parseRosterText(text, tags);
}
