import { describe, expect, it } from 'vitest';

import {
  addKeepApart,
  addStudents,
  cycleNeed,
  fillMissingLevels,
  findStudents,
  MAX_NAME_LENGTH,
  MAX_STUDENTS,
  planAdd,
  removeAllStudents,
  removeKeepApart,
  removeStudent,
  setLevel,
  updateColorTag,
} from '@modules/classroom/rosterEdits';
import { docWith, emptyDoc, student } from '@test/classroomDocs';

describe('addStudents', () => {
  it('adds new teammates with their level and color, and fresh ids', () => {
    const { doc, added } = addStudents(emptyDoc(), [
      { name: 'Ava', level: 1, color: null },
      { name: 'Ben', level: null, color: 2 },
    ]);
    expect(added).toBe(2);
    expect(doc.students.map((s) => [s.name, s.level, s.color])).toEqual([
      ['Ava', 1, null],
      ['Ben', null, 2],
    ]);
    expect(new Set(doc.students.map((s) => s.id)).size).toBe(2);
    doc.students.forEach((s) => expect(s.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/));
  });

  it('uses first names only when that’s on, keeping a last initial for shared first names', () => {
    const { doc } = addStudents(emptyDoc(), [
      { name: 'Ava Rossi', level: null, color: null },
      { name: 'Ava Chen', level: null, color: null },
    ]);
    expect(doc.students.map((s) => s.name)).toEqual(['Ava R.', 'Ava C.']);
  });

  it('adds two teammates whose last names start with the same letter', () => {
    const { doc, added } = addStudents(emptyDoc(), [
      { name: 'Ava Rossi', level: null, color: null },
      { name: 'Ava Russo', level: null, color: null },
    ]);
    expect(added).toBe(2);
    expect(doc.students.map((s) => s.name)).toEqual(['Ava Ro.', 'Ava Ru.']);
  });

  it('treats a pasted full name as the shortened teammate already in, but adds one typed short on purpose', () => {
    const doc = docWith([student('a', 'Ava')]);
    expect(addStudents(doc, [{ name: 'Ava Rossi', level: null, color: null }]).added).toBe(0);
    const second = addStudents(doc, [{ name: 'Ava C.', level: null, color: null }]);
    expect(second.doc.students.map((s) => s.name)).toEqual(['Ava', 'Ava C.']);
  });

  it('leaves out names already in the team', () => {
    const result = addStudents(docWith([student('a', 'Ava')]), [{ name: 'ava', level: null, color: null }]);
    expect(result.added).toBe(0);
    expect(result.alreadyIn).toEqual(['ava']);
  });

  it('stops at the team size the server allows', () => {
    const many = Array.from({ length: MAX_STUDENTS + 2 }, (_, i) => ({ name: `Person ${i}`, level: null, color: null }));
    const doc = { ...emptyDoc(), settings: { ...emptyDoc().settings, firstNamesOnly: false } };
    const result = addStudents(doc, many);
    expect(result.doc.students).toHaveLength(MAX_STUDENTS);
    expect(result.classFull).toEqual([`Person ${MAX_STUDENTS}`, `Person ${MAX_STUDENTS + 1}`]);
    expect(result.skipped.map((entry) => entry.name)).toEqual([`Person ${MAX_STUDENTS}`, `Person ${MAX_STUDENTS + 1}`]);
  });

  it('keeps the entries it left out, so they can stay in the notebook', () => {
    const entry = { name: 'Ava', level: 1 as const, color: 2 };
    const result = addStudents(docWith([student('a', 'Ava')]), [entry, { name: 'Ben', level: null, color: null }]);
    expect(result.added).toBe(1);
    expect(result.skipped).toEqual([entry]);
  });

  it('treats names that differ only in accents as the same teammate', () => {
    const result = addStudents(docWith([student('a', 'José')]), [{ name: 'Jose', level: null, color: null }]);
    expect(result.added).toBe(0);
  });

  it('cuts names to the length the server allows', () => {
    const { doc } = addStudents(emptyDoc(), [{ name: 'A'.repeat(80), level: null, color: null }]);
    expect(doc.students[0].name).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('planAdd', () => {
  it('says what adding each entry would do, without changing anything', () => {
    const doc = docWith([student('a', 'Ava')]);
    const plan = planAdd(doc, [
      { name: 'Ava', level: null, color: null },
      { name: 'Ben', level: null, color: null },
      { name: 'ben', level: null, color: null },
    ]);
    expect(plan).toEqual([
      { name: 'Ava', status: 'alreadyIn' },
      { name: 'Ben', status: 'new' },
      { name: 'ben', status: 'alreadyIn' },
    ]);
    expect(doc.students).toHaveLength(1);
  });

  it('marks entries past the team size as classFull', () => {
    const full = docWith(Array.from({ length: MAX_STUDENTS }, (_, i) => student(`s${i}`, `Person ${i}`)));
    expect(planAdd(full, [{ name: 'Zoe', level: null, color: null }])).toEqual([{ name: 'Zoe', status: 'classFull' }]);
  });

  it('doesn’t change the document it was given', () => {
    const before = emptyDoc();
    addStudents(before, [{ name: 'Ava', level: null, color: null }]);
    expect(before.students).toEqual([]);
  });
});

describe('levels', () => {
  it('sets one teammate’s level', () => {
    const doc = setLevel(docWith([student('a', 'Ava'), student('b', 'Ben')]), 'b', 3);
    expect(doc.students.map((s) => s.level)).toEqual([null, 3]);
  });

  it('makes everyone without a level a 2', () => {
    const doc = fillMissingLevels(docWith([student('a', 'Ava', 1), student('b', 'Ben')]), 2);
    expect(doc.students.map((s) => s.level)).toEqual([1, 2]);
  });
});

describe('cycleNeed', () => {
  it('goes Off → Must → Nice to have → Off', () => {
    let doc = docWith([student('a', 'Ava')]);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      doc = cycleNeed(doc, 'a', 'near-front');
      seen.push(doc.students[0].needs['near-front'] ?? 'off');
    }
    expect(seen).toEqual(['must', 'nice', 'off']);
  });
});

describe('removeStudent', () => {
  it('removes them from pairs, seats and seat locks too', () => {
    const doc = {
      ...docWith([student('a', 'Ava'), student('b', 'Ben')]),
      keepApart: [{ a: 'a', b: 'b' }],
      seating: { assignment: { s1: 'a', s2: 'b' }, lockedSeats: ['s1', 's2'], checkedOff: [] },
    };
    const after = removeStudent(doc, 'a');
    expect(after.students.map((s) => s.id)).toEqual(['b']);
    expect(after.keepApart).toEqual([]);
    expect(after.seating.assignment).toEqual({ s2: 'b' });
    expect(after.seating.lockedSeats).toEqual(['s2']);
  });
});

describe('removeAllStudents', () => {
  it('starts the team over but keeps the room', () => {
    const doc = {
      ...docWith([student('a', 'Ava'), student('b', 'Ben')]),
      keepApart: [{ a: 'a', b: 'b' }],
      seating: { assignment: { s1: 'a' }, lockedSeats: ['s1'], checkedOff: [] },
    };
    const after = removeAllStudents(doc);
    expect(after.students).toEqual([]);
    expect(after.keepApart).toEqual([]);
    expect(after.seating).toEqual({ assignment: {}, lockedSeats: [], checkedOff: [] });
    expect(after.savedCharts).toEqual([]);
    expect(after.room).toBe(doc.room);
  });
});

describe('keep apart', () => {
  it('adds a pair once, in either order, never with oneself', () => {
    let doc = docWith([student('a', 'Ava'), student('b', 'Ben')]);
    doc = addKeepApart(doc, 'a', 'b');
    doc = addKeepApart(doc, 'b', 'a');
    doc = addKeepApart(doc, 'a', 'a');
    expect(doc.keepApart).toEqual([{ a: 'a', b: 'b' }]);
    expect(removeKeepApart(doc, 'b', 'a').keepApart).toEqual([]);
  });
});

describe('findStudents', () => {
  const students = [student('a', 'Finn'), student('b', 'Fiona'), student('c', 'José Ortiz'), student('d', 'Ava Fisher')];

  it('finds names that start with what was typed, ignoring case', () => {
    expect(findStudents(students, 'fi').map((s) => s.name)).toEqual(['Finn', 'Fiona', 'Ava Fisher']);
  });

  it('ignores accents', () => {
    expect(findStudents(students, 'jose').map((s) => s.name)).toEqual(['José Ortiz']);
  });

  it('finds nothing for an empty box', () => {
    expect(findStudents(students, '  ')).toEqual([]);
  });
});

describe('color tag names', () => {
  it('turns separators into spaces, so names written back as lines read the same', () => {
    const doc = updateColorTag(emptyDoc(), 0, { name: 'Quiet, front' });
    expect(doc.colors.tags[0].name).toBe('Quiet front');
  });

  it('keeps the old name when the new one would be empty', () => {
    const doc = updateColorTag(emptyDoc(), 0, { name: '\u0007 ' });
    expect(doc.colors.tags[0].name).toBe('Pink');
  });
});

describe('removeStudent', () => {
  it('removes every trace of the teammate, including past and saved charts', () => {
    const doc = {
      ...docWith([student('a', 'Ava'), student('b', 'Ben')]),
      keepApart: [{ a: 'a', b: 'b' }],
    };
    doc.seating = { assignment: { s1: 'a', s2: 'b' }, lockedSeats: ['s1'], checkedOff: ['unseated||a|', 'ones-side-by-side||a,b|s1,s2', 'no-level||b|'] };
    doc.history = [{ at: '2026-10-01T00:00:00.000Z', assignment: { s1: 'a', s2: 'b' } }];
    doc.savedCharts = [{ id: 'c1', name: 'Fall', savedAt: '2026-10-01T00:00:00.000Z', layoutId: 'x', assignment: { s1: 'a' } }];
    const after = removeStudent(doc, 'a');
    expect(after.students.map((s) => s.id)).toEqual(['b']);
    expect(after.keepApart).toEqual([]);
    expect(after.seating).toEqual({ assignment: { s2: 'b' }, lockedSeats: [], checkedOff: ['no-level||b|'] });
    expect(after.history[0].assignment).toEqual({ s2: 'b' });
    expect(after.savedCharts[0].assignment).toEqual({});
  });
});
