import { describe, expect, it } from 'vitest';

import { firstNamesOnly } from '@modules/classroom/roster/names';
import { detectDelimiter, parseRosterTable, splitDelimited } from '@modules/classroom/roster/table';
import { parseRosterText } from '@modules/classroom/rosterImport';

const TAGS = [
  { name: 'Pink', inUse: true },
  { name: 'Reading group A', inUse: true },
  { name: 'Blue', inUse: true },
  { name: 'Purple', inUse: true },
];

/** [name, level] for each student read from `text`. */
const read = (text: string) => parseRosterText(text, TAGS).map((e) => [e.name, e.level]);
const names = (text: string) => parseRosterText(text, TAGS).map((e) => e.name);

describe('parseRosterText: plain lists', () => {
  it('reads one name per line, skipping blank lines and extra spaces', () => {
    expect(names('Ava\n\n  Ben   Ortiz \r\nChloe')).toEqual(['Ava', 'Ben Ortiz', 'Chloe']);
  });

  it('copes with odd spaces and invisible characters from Word or a website', () => {
    expect(names('Ava Rossi​\nBen Ortiz')).toEqual(['Ava Rossi', 'Ben Ortiz']);
  });

  it('keeps accents, hyphens and apostrophes', () => {
    expect(names('Luz Fernández\nMary-Kate O’Brien\nZoë Ñúñez')).toEqual(['Luz Fernández', "Mary-Kate O'Brien", 'Zoë Ñúñez']);
  });

  it('fixes names typed in all caps or all lowercase, but leaves mixed case alone', () => {
    expect(names('AVA ROSSI\nben ortiz\nDeShawn McDonald\nmary-kate o’brien')).toEqual([
      'Ava Rossi',
      'Ben Ortiz',
      'DeShawn McDonald',
      "Mary-Kate O'Brien",
    ]);
  });

  it('skips headings like "Names" or "Team list"', () => {
    expect(names('Team list:\nNames\nAva\nBen')).toEqual(['Ava', 'Ben']);
  });

  it('drops trailing punctuation', () => {
    expect(names('Ava,\nBen;\nChloe.')).toEqual(['Ava', 'Ben', 'Chloe']);
  });
});

describe('parseRosterText: levels', () => {
  it.each([
    ['Ava, 1', 1],
    ['Ava 1', 1],
    ['Ava - 1', 1],
    ['Ava (1)', 1],
    ['Ava [2]', 2],
    ['Ava: 3', 3],
    ['Ava | 2', 2],
    ['Ava; 3', 3],
    ['Ava, level 2', 2],
    ['Ava Level 2', 2],
    ['Ava L3', 3],
    ['Ava lvl 1', 1],
    ['Ava, red', 1],
    ['Ava, yellow', 2],
    ['Ava, green', 3],
    ['1 Ava', 1],
    ['1, Ava', 1],
    ['(2) Ava', 2],
    ['L3 Ava', 3],
  ])('reads "%s" as level %i', (line, level) => {
    expect(read(line)).toEqual([['Ava', level]]);
  });

  it('ignores numbers that can’t be levels', () => {
    expect(read('Ava, 4\nBen, 0')).toEqual([
      ['Ava', null],
      ['Ben', null],
    ]);
  });

  it('doesn’t mistake a surname like Green for a level', () => {
    expect(read('Erik Green\nAva Red')).toEqual([
      ['Erik Green', null],
      ['Ava Red', null],
    ]);
  });
});

describe('parseRosterText: numbered and bulleted lists', () => {
  it('drops the numbers of a list that counts 1, 2, 3, 4…', () => {
    expect(read('1 Ava\n2 Ben\n3 Chloe\n4 Diego')).toEqual([
      ['Ava', null],
      ['Ben', null],
      ['Chloe', null],
      ['Diego', null],
    ]);
  });

  it.each(['1. Ava\n2. Ben', '1) Ava\n2) Ben', '#1 Ava\n#2 Ben', '(1) Ava\n(2) Ben', '1 - Ava\n2 - Ben'])(
    'drops list numbers in "%s"',
    (text) => {
      expect(read(text)).toEqual([
        ['Ava', null],
        ['Ben', null],
      ]);
    },
  );

  it('still reads a level after a list number', () => {
    expect(read('1) 1 Ava Rossi\n2) Ben Ortiz 2\n3. 3, Chloe')).toEqual([
      ['Ava Rossi', 1],
      ['Ben Ortiz', 2],
      ['Chloe', 3],
    ]);
  });

  it('takes a plain number for a level when the list doesn’t count up', () => {
    expect(read('1) Ava\n3, Chloe Park')).toEqual([
      ['Ava', null],
      ['Chloe Park', 3],
    ]);
  });

  it.each(['• Ava\n• Ben', '- Ava\n- Ben', '* Ava\n* Ben', '– Ava\n– Ben', '◦ Ava\n◦ Ben', '☐ Ava\n☐ Ben', '✓ Ava\n✓ Ben'])(
    'drops bullets in "%s"',
    (text) => {
      expect(names(text)).toEqual(['Ava', 'Ben']);
    },
  );
});

describe('parseRosterText: last name first', () => {
  it('turns "Rossi, Ava" into "Ava Rossi"', () => {
    expect(read('Rossi, Ava\nOrtiz, Ben, 2\nPARK, CHLOE M.')).toEqual([
      ['Ava Rossi', null],
      ['Ben Ortiz', 2],
      ['Chloe M. Park', null],
    ]);
  });

  it('doesn’t flip a list where names come with a level', () => {
    expect(read('Ava Rossi, 1\nBen Ortiz, 2')).toEqual([
      ['Ava Rossi', 1],
      ['Ben Ortiz', 2],
    ]);
  });
});

describe('parseRosterText: several names on one line', () => {
  it.each(['Ava, Ben, Chloe, Diego', 'Ava; Ben; Chloe; Diego', 'Ava,Ben,Chloe,Diego'])('splits "%s"', (text) => {
    expect(names(text)).toEqual(['Ava', 'Ben', 'Chloe', 'Diego']);
  });

  it('splits "Last, First" names separated by semicolons', () => {
    expect(names('Rossi, Ava; Ortiz, Ben; Park, Chloe')).toEqual(['Ava Rossi', 'Ben Ortiz', 'Chloe Park']);
  });
});

describe('parseRosterText: emails, IDs and nicknames', () => {
  it('reads Google Office style lists with an email under each name', () => {
    expect(names('Ava Rossi\nava.rossi@company.org\nBen Ortiz\nben.ortiz@company.org')).toEqual(['Ava Rossi', 'Ben Ortiz']);
  });

  it('removes an email next to the name', () => {
    expect(names('Ava Rossi <ava.rossi@company.org>\nBen Ortiz ben@company.org\nChloe, chloe@company.org')).toEqual([
      'Ava Rossi',
      'Ben Ortiz',
      'Chloe',
    ]);
  });

  it('makes names from a list of emails only', () => {
    expect(names('ava.rossi@school.org\nben_ortiz22@school.org')).toEqual(['Ava Rossi', 'Ben Ortiz']);
  });

  it('drops teammate ID numbers', () => {
    expect(read('104522 Ava Rossi\nBen Ortiz 104523\nChloe, 104524, 3')).toEqual([
      ['Ava Rossi', null],
      ['Ben Ortiz', null],
      ['Chloe', 3],
    ]);
  });

  it('uses a nickname in parentheses or quotes', () => {
    expect(names('Alexander (Alex) Smith\nElizabeth "Liz" Brown')).toEqual(['Alex Smith', 'Liz Brown']);
  });

  it('reads a color tag after the name, by its starting name or the manager’s', () => {
    expect(parseRosterText('Noah, 3, blue\nMia, reading group a, 1\nOwen, orange', TAGS)).toEqual([
      { name: 'Noah', level: 3, color: 2 },
      { name: 'Mia', level: 1, color: 1 },
      { name: 'Owen', level: null, color: 1 },
    ]);
  });
});

describe('parseRosterText: cells copied from Sheets or Excel', () => {
  it('uses the header row to find the columns, in any order', () => {
    const pasted = 'Teammate ID\tLast Name\tFirst Name\tLevel\tEmail\n1001\tRossi\tAva\t1\tava@company.org\n1002\tOrtiz\tBen\t\tben@company.org';
    expect(read(pasted)).toEqual([
      ['Ava Rossi', 1],
      ['Ben Ortiz', null],
    ]);
  });

  it('reads first and last name columns without a header', () => {
    expect(read('Ava\tRossi\t1\nBen\tOrtiz')).toEqual([
      ['Ava Rossi', 1],
      ['Ben Ortiz', null],
    ]);
  });

  it('reads a single column with a level next to it', () => {
    expect(read('Noah\t2')).toEqual([['Noah', 2]]);
  });
});

describe('parseRosterTable: spreadsheet files', () => {
  it('finds columns by their headers, ignoring the rest', () => {
    const rows = [
      ['First Name', 'Last Name', 'Level', 'Color', 'Grade'],
      ['Ava', 'Rossi', '1', 'pink', '4'],
      ['Ben', 'Ortiz', '5', '', '4'],
    ];
    expect(parseRosterTable(rows, TAGS)).toEqual([
      { name: 'Ava Rossi', level: 1, color: 0 },
      { name: 'Ben Ortiz', level: null, color: null },
    ]);
  });

  it('prefers a preferred name or nickname column', () => {
    const rows = [
      ['First Name', 'Preferred Name', 'Last Name'],
      ['Alexander', 'Alex', 'Smith'],
      ['Ava', '', 'Rossi'],
    ];
    expect(parseRosterTable(rows, TAGS).map((e) => e.name)).toEqual(['Alex Smith', 'Ava Rossi']);
  });

  it('reads a "Last, First" name column, as many company systems export it', () => {
    expect(parseRosterTable([['Teammate Name'], ['Rossi, Ava'], ['Ortiz, Ben']], TAGS).map((e) => e.name)).toEqual([
      'Ava Rossi',
      'Ben Ortiz',
    ]);
    expect(parseRosterTable([['Name (Last, First)', 'Level'], ['Rossi, Ava', '2']], TAGS)).toEqual([
      { name: 'Ava Rossi', level: 2, color: null },
    ]);
  });

  it('understands Spanish headers', () => {
    expect(parseRosterTable([['Nombre', 'Apellido', 'Nivel'], ['Luz', 'Fernández', '3']], TAGS)).toEqual([
      { name: 'Luz Fernández', level: 3, color: null },
    ]);
  });

  it('reads rows like pasted lines when there is no header', () => {
    expect(parseRosterTable([['Ava', '1'], ['Ben', '3']], TAGS).map((e) => e.level)).toEqual([1, 3]);
  });
});

describe('splitDelimited and detectDelimiter', () => {
  it('keeps delimiters and quotes inside quoted cells', () => {
    expect(splitDelimited('"Ortiz, Ben",2\n"Say ""hi""",1')).toEqual([
      ['Ortiz, Ben', '2'],
      ['Say "hi"', '1'],
    ]);
  });

  it('finds commas, semicolons (European Excel) and tabs', () => {
    expect(detectDelimiter('Name,Level\nAva,1')).toBe(',');
    expect(detectDelimiter('Name;Level\nAva;1')).toBe(';');
    expect(detectDelimiter('Name\tLevel\nAva\t1')).toBe('\t');
  });
});

describe('firstNamesOnly', () => {
  it('drops last names', () => {
    expect(firstNamesOnly(['Ava Rossi', 'Ben Ortiz'])).toEqual(['Ava', 'Ben']);
  });

  it('keeps a last initial when two teammates share a first name', () => {
    expect(firstNamesOnly(['Ava Rossi', 'Ava Chen', 'Ben Ortiz'])).toEqual(['Ava R.', 'Ava C.', 'Ben']);
  });

  it('takes the initial from the last name, not a middle name or "Jr."', () => {
    expect(firstNamesOnly(['Ava Marie Rossi', 'Ava Chen Jr.'])).toEqual(['Ava R.', 'Ava C.']);
  });

  it('also looks at teammates already in the team', () => {
    expect(firstNamesOnly(['Ava Chen'], ['Ava'])).toEqual(['Ava C.']);
  });

  it('adds letters when two last names start the same', () => {
    expect(firstNamesOnly(['Ava Rossi', 'Ava Russo', 'Ava Chen'])).toEqual(['Ava Ro.', 'Ava Ru.', 'Ava C.']);
    expect(firstNamesOnly(['Liam Li', 'Liam Lim'])).toEqual(['Liam Li', 'Liam Lim']);
  });

  it('counts José and Jose as the same first name', () => {
    expect(firstNamesOnly(['José Ruiz', 'Jose Diaz'])).toEqual(['José R.', 'Jose D.']);
  });
});
