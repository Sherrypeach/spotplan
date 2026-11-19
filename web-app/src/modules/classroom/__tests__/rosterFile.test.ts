// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readRosterFile, RosterFileError } from '@modules/classroom/roster/file';

const TAGS = ['Pink', 'Orange', 'Blue', 'Purple'].map((name) => ({ name, inUse: true }));
const FIXTURES = join(__dirname, 'fixtures');

function fixture(name: string, type = ''): File {
  return new File([readFileSync(join(FIXTURES, name))], name, { type });
}

function textFile(name: string, text: string): File {
  return new File([text], name, { type: 'text/plain' });
}

describe('readRosterFile', () => {
  it('reads an Excel file, finding the columns by their headers', async () => {
    const entries = await readRosterFile(fixture('roster.xlsx'), TAGS);
    expect(entries.map((e) => [e.name, e.level])).toEqual([
      ['Ava Rossi', 1],
      ['Luz Fernández', 3],
      ['Ben Ortiz', null],
    ]);
  });

  it('reads a semicolon CSV saved by older Excel on Windows, accents and all', async () => {
    const entries = await readRosterFile(fixture('roster-windows.csv', 'text/csv'), TAGS);
    expect(entries.map((e) => [e.name, e.level])).toEqual([
      ['Luz Fernández', 2],
      ['José Núñez', null],
    ]);
  });

  it('reads a comma CSV with quoted "Last, First" names', async () => {
    const csv = 'Teammate Name,Level\n"Rossi, Ava",1\n"Ortiz, Ben",\n';
    const entries = await readRosterFile(textFile('class.csv', csv), TAGS);
    expect(entries.map((e) => [e.name, e.level])).toEqual([
      ['Ava Rossi', 1],
      ['Ben Ortiz', null],
    ]);
  });

  it('reads a plain text file like a pasted list', async () => {
    const entries = await readRosterFile(textFile('names.txt', '1. Ava Rossi\n2. Ben Ortiz, 3'), TAGS);
    expect(entries.map((e) => [e.name, e.level])).toEqual([
      ['Ava Rossi', null],
      ['Ben Ortiz', 3],
    ]);
  });

  it('explains what to do with an old .xls file', async () => {
    await expect(readRosterFile(textFile('class.xls', ''), TAGS)).rejects.toBeInstanceOf(RosterFileError);
  });

  it('explains what to do with a file it can’t read', async () => {
    await expect(readRosterFile(textFile('class.docx', ''), TAGS)).rejects.toThrow(/paste them/);
  });
});
