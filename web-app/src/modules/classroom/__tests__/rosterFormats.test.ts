import { describe, expect, it } from 'vitest';

import { decodeText, readRosterFile, RosterFileError } from '@modules/classroom/roster/file';
import { findHeader, parseRosterTable } from '@modules/classroom/roster/table';
import { parseRosterText } from '@modules/classroom/rosterImport';
import { fitText, storableText } from '@shared/text';

const TAGS = [{ name: 'Green', inUse: true }];
const read = (text: string) => parseRosterText(text, TAGS).map((e) => [e.name, e.level]);

describe('parseRosterText: more formats', () => {
  it('reads a level inside a last-name-first line', () => {
    expect(read('Rossi, Ava 1\nOrtiz, Ben 3')).toEqual([
      ['Ava Rossi', 1],
      ['Ben Ortiz', 3],
    ]);
  });

  it('reads a single "Last, First" line as one teammate', () => {
    expect(read('Rossi, Ava')).toEqual([['Ava Rossi', null]]);
  });

  it('reads "Ben L 2" as Ben L. at level 2', () => {
    expect(read('Ben L 2')[0][1]).toBe(2);
  });

  it('keeps a suffix with a last-name-first name', () => {
    expect(read('Smith, John, III')).toEqual([['John Smith III', null]]);
    expect(read('Smith, John, Jr.\nRossi, Ava')).toEqual([
      ['John Smith Jr.', null],
      ['Ava Rossi', null],
    ]);
  });

  it('reads a tag the manager named "Green" as their color, not level 3', () => {
    const [entry] = parseRosterText('Ava, Green', TAGS);
    expect(entry.level).toBeNull();
    expect(entry.color).toBe(0);
  });
});

// No tags named after colors here, so "green" can only be a level.
const readPlain = (text: string) => parseRosterText(text, []).map((e) => [e.name, e.level]);

describe('parseRosterText: surnames, headings and odd cells', () => {
  it('reads a surname that is a color word as a surname, not a level', () => {
    expect(readPlain('Green, Ava\nRossi, Ben\nCruz, Chloe')).toEqual([
      ['Ava Green', null],
      ['Ben Rossi', null],
      ['Chloe Cruz', null],
    ]);
    expect(read('Red, Ava')).toEqual([['Ava Red', null]]);
  });

  it('still reads a color word after the name as a level', () => {
    expect(readPlain('Ava Rossi, green')).toEqual([['Ava Rossi', 3]]);
  });

  it('reads a pasted "Ava\tGreen" row as first and last name', () => {
    expect(readPlain('Ava\tGreen\nBen\tRossi')).toEqual([
      ['Ava Green', null],
      ['Ben Rossi', null],
    ]);
  });

  it('reads a column of only color words as levels', () => {
    expect(readPlain('Ava Rossi\tred\nBen Cruz\tgreen')).toEqual([
      ['Ava Rossi', 1],
      ['Ben Cruz', 3],
    ]);
  });

  it('keeps first names under a one-cell heading above pasted cells', () => {
    expect(read('Teammates\nRossi\tAva\nCruz\tBen')).toEqual([
      ['Rossi Ava', null],
      ['Cruz Ben', null],
    ]);
  });

  it('skips a header row it doesn’t know by name', () => {
    expect(read('Teammate Names\tLevel\nAva Rossi\t2')).toEqual([['Ava Rossi', 2]]);
  });

  it('reads "Last, First" on one line among first-name-first lines', () => {
    expect(read('Ava Rossi\nCruz, Ben')).toEqual([
      ['Ava Rossi', null],
      ['Ben Cruz', null],
    ]);
  });

  it('moves a suffix to the end of a last-name-first name', () => {
    expect(read('Smith, John Jr.\nRossi, Ava')).toEqual([
      ['John Smith Jr.', null],
      ['Ava Rossi', null],
    ]);
  });

  it('reads a level written inside the name under a header', () => {
    expect(read('Name\tLevel\nAva Rossi (2)\t\nBen Cruz\t3')).toEqual([
      ['Ava Rossi', 2],
      ['Ben Cruz', 3],
    ]);
  });

  it('leaves names with their own capitals as typed', () => {
    expect(read('Ana María de la Cruz')).toEqual([['Ana María de la Cruz', null]]);
  });

  it('stays quick on huge junk cells', () => {
    const started = Date.now();
    parseRosterText(`Name\n${'A' + ';'.repeat(100_000) + 'B'}`, TAGS);
    parseRosterText(`Ava, Ben, ${'a'.repeat(19_980)}@`, TAGS);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('spreadsheet tables', () => {
  it('finds the header under a title row', () => {
    const rows = [['Mrs. Lee 4th grade'], ['First name', 'Last name', 'Level'], ['Ava', 'Rossi', '1']];
    expect(findHeader(rows)?.index).toBe(1);
    expect(parseRosterTable(rows, []).map((e) => [e.name, e.level])).toEqual([['Ava Rossi', 1]]);
  });

  it('skips empty rows', () => {
    const rows = [['Name'], [''], ['Ava'], [], ['Ben']];
    expect(parseRosterTable(rows, []).map((e) => e.name)).toEqual(['Ava', 'Ben']);
  });
});

describe('decodeText', () => {
  const utf16le = (text: string) => {
    const bytes = new Uint8Array(text.length * 2);
    [...text].forEach((char, index) => (bytes[index * 2] = char.charCodeAt(0)));
    return bytes;
  };

  it('reads UTF-16 with or without its marker', () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, ...utf16le('Ava\nBen')]))).toBe('Ava\nBen');
    expect(decodeText(utf16le('Ava\nBen'))).toBe('Ava\nBen');
  });

  it('falls back to Windows-1252 for old Excel files', () => {
    expect(decodeText(new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]))).toBe('José');
  });
});

describe('readRosterFile', () => {
  it('refuses files it can’t read with a plain message', async () => {
    await expect(readRosterFile(new File(['x'], 'list.pdf'), [])).rejects.toBeInstanceOf(RosterFileError);
    await expect(readRosterFile(new File(['x'], 'old.xls'), [])).rejects.toThrow(/\.xls/);
  });

  it('finds the delimiter below a title line', async () => {
    const entries = await readRosterFile(new File(['Room 12\nNombre;Apellido;Nivel\nAva;Rossi;2\n'], 'class.csv'), []);
    expect(entries.map((e) => [e.name, e.level])).toEqual([['Ava Rossi', 2]]);
  });

  it('reads a CSV without a header like pasted lines', async () => {
    const entries = await readRosterFile(new File(['Rossi, Ava\nOrtiz, Ben\n'], 'class.csv'), []);
    expect(entries.map((e) => e.name)).toEqual(['Ava Rossi', 'Ben Ortiz']);
  });
});

describe('text limits', () => {
  it('counts like the API (UTF-16 units) and never splits an emoji', () => {
    expect(fitText('ab😀', 4)).toBe('ab😀');
    expect(fitText('ab😀', 3)).toBe('ab');
  });

  it('drops control characters and lone surrogates', () => {
    expect(storableText('A\u0007va\uD800')).toBe('Ava');
  });
});
