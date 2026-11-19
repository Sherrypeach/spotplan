import type { ClassroomDocument, DocStudent, SeatAssignment } from '@modules/classroom/document';
import { foldName, nameParts } from '@modules/classroom/roster/names';
import { firstNamesOnly, type RosterEntry } from '@modules/classroom/rosterImport';
import type { Level, NeedKind, NeedStrength } from '@modules/seating/engine/types';
import { fitText, storableText } from '@shared/text';

// Pure edits to a class document: each returns a new document, never changes the old one.

export { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_STUDENTS, MAX_TAG_NAME_LENGTH } from '@modules/classroom/rosterLimits';
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_STUDENTS, MAX_TAG_NAME_LENGTH } from '@modules/classroom/rosterLimits';
import { MAX_KEEP_APART } from '@shared/serverLimits';
export { MAX_KEEP_APART };


/** Same name, ignoring case and accents: "José" and "jose". */
function sameName(a: string, b: string): boolean {
  return foldName(a.trim()) === foldName(b.trim());
}

function newStudentId(taken: Set<string>): string {
  let id: string;
  do {
    id = `s_${Math.random().toString(36).slice(2, 10)}`;
  } while (taken.has(id));
  return id;
}

/** What adding one pasted line would do. */
export type AddPlan = {
  name: string;
  status: 'new' | 'alreadyIn' | 'classFull';
};

/**
 * The name each entry gets once added (first names only, if that's on), and
 * whether it would be added: the preview and the Add button both use this.
 */
export function planAdd(doc: ClassroomDocument, entries: RosterEntry[]): AddPlan[] {
  const rawNames = entries.map((entry) => entry.name);
  const existing = doc.students.map((student) => student.name);
  // With first names only, "Noah Smith" pasted again is the "Noah" (or
  // "Noah S.") already in the class, not a second Noah.
  // A name typed short on purpose ("Ava C.") is a new student even when an "Ava" is already in.
  const shortenedAlreadyIn = (raw: string) => {
    if (!doc.settings.firstNamesOnly) return false;
    const { first, last } = nameParts(raw);
    if (!last || /^\p{L}\.?$/u.test(last)) return false;
    // "Ava", "Ava R." or "Ava Ro." already in is this "Ava Rossi" pasted again.
    return existing.some((name) => {
      const short = nameParts(name);
      return sameName(short.first, first) && foldName(last).startsWith(foldName(short.last.replace(/\.$/, '')));
    });
  };
  const names = doc.settings.firstNamesOnly ? firstNamesOnly(rawNames, existing) : rawNames;
  const taken = [...existing];
  return names.map((rawName, index) => {
    const name = fitText(storableText(rawName), MAX_NAME_LENGTH).trim();
    if (taken.some((other) => sameName(other, name)) || shortenedAlreadyIn(rawNames[index])) return { name, status: 'alreadyIn' };
    if (taken.length >= MAX_STUDENTS) return { name, status: 'classFull' };
    taken.push(name);
    return { name, status: 'new' };
  });
}

export type AddResult = {
  doc: ClassroomDocument;
  added: number;
  /** Entries left out (already in the class, or the class was full), to keep in the notebook. */
  skipped: RosterEntry[];
  alreadyIn: string[];
  classFull: string[];
};

export function addStudents(doc: ClassroomDocument, entries: RosterEntry[]): AddResult {
  const plan = planAdd(doc, entries);
  const ids = new Set(doc.students.map((student) => student.id));
  const students = [...doc.students];
  const skipped: RosterEntry[] = [];

  plan.forEach(({ name, status }, index) => {
    const entry = entries[index];
    if (status !== 'new' || !name) {
      skipped.push(entry);
      return;
    }
    const id = newStudentId(ids);
    ids.add(id);
    students.push({ id, name, level: entry.level, color: entry.color, needs: {}, note: '' });
  });

  return {
    doc: { ...doc, students },
    added: students.length - doc.students.length,
    skipped,
    alreadyIn: plan.filter((step) => step.status === 'alreadyIn').map((step) => step.name),
    classFull: plan.filter((step) => step.status === 'classFull').map((step) => step.name),
  };
}

function updateStudent(doc: ClassroomDocument, id: string, change: Partial<DocStudent>): ClassroomDocument {
  return {
    ...doc,
    students: doc.students.map((student) => (student.id === id ? { ...student, ...change } : student)),
  };
}

export function setLevel(doc: ClassroomDocument, id: string, level: Level | null): ClassroomDocument {
  return updateStudent(doc, id, { level });
}

/** Everyone without a level becomes `level` (a 2, after the teacher picked the 1s and 3s). */
export function fillMissingLevels(doc: ClassroomDocument, level: Level): ClassroomDocument {
  return {
    ...doc,
    students: doc.students.map((student) => (student.level === null ? { ...student, level } : student)),
  };
}

const NEXT_STRENGTH: Record<'off' | NeedStrength, NeedStrength | null> = {
  off: 'must',
  must: 'nice',
  nice: null,
};

/** Each tap goes Off → Must → Nice to have → Off. */
export function cycleNeed(doc: ClassroomDocument, id: string, kind: NeedKind): ClassroomDocument {
  const student = doc.students.find((s) => s.id === id);
  if (!student) return doc;
  const next = NEXT_STRENGTH[student.needs[kind] ?? 'off'];
  const needs = { ...student.needs };
  if (next) needs[kind] = next;
  else delete needs[kind];
  return updateStudent(doc, id, { needs });
}

export function setColor(doc: ClassroomDocument, id: string, color: number | null): ClassroomDocument {
  return updateStudent(doc, id, { color });
}

export function setNote(doc: ClassroomDocument, id: string, note: string): ClassroomDocument {
  return updateStudent(doc, id, { note: fitText(storableText(note), MAX_NOTE_LENGTH) });
}

/** Takes a student out of the class and everything that mentions them. */
function withoutStudent(assignment: SeatAssignment, id: string): SeatAssignment {
  return Object.fromEntries(Object.entries(assignment).filter(([, studentId]) => studentId !== id));
}

/** Removes a student and every trace of them: pairs, seats, past and saved charts. */
export function removeStudent(doc: ClassroomDocument, id: string): ClassroomDocument {
  const theirSeats = Object.keys(doc.seating.assignment).filter((seat) => doc.seating.assignment[seat] === id);
  return {
    ...doc,
    students: doc.students.filter((student) => student.id !== id),
    keepApart: doc.keepApart.filter((pair) => pair.a !== id && pair.b !== id),
    seating: {
      assignment: withoutStudent(doc.seating.assignment, id),
      lockedSeats: doc.seating.lockedSeats.filter((seat) => !theirSeats.includes(seat)),
      checkedOff: doc.seating.checkedOff.filter((key) => !(key.split('|')[2] ?? '').split(',').includes(id)),
    },
    history: doc.history.map((chart) => ({ ...chart, assignment: withoutStudent(chart.assignment, id) })),
    savedCharts: doc.savedCharts.map((chart) => ({ ...chart, assignment: withoutStudent(chart.assignment, id) })),
  };
}

/** Starts the class over: every student goes, with their seats, keep-apart pairs and past charts. The room stays. */
export function removeAllStudents(doc: ClassroomDocument): ClassroomDocument {
  return { ...doc, students: [], keepApart: [], seating: { assignment: {}, lockedSeats: [], checkedOff: [] }, history: [], savedCharts: [] };
}

function isPair(pair: { a: string; b: string }, a: string, b: string): boolean {
  return (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a);
}

export function isKeptApart(doc: ClassroomDocument, a: string, b: string): boolean {
  return doc.keepApart.some((pair) => isPair(pair, a, b));
}

/** Adds a pair; the document comes back unchanged for a repeat pair, a student with themself, or a full list. */
export function addKeepApart(doc: ClassroomDocument, a: string, b: string): ClassroomDocument {
  if (a === b || isKeptApart(doc, a, b) || doc.keepApart.length >= MAX_KEEP_APART) return doc;
  return { ...doc, keepApart: [...doc.keepApart, { a, b }] };
}

export function removeKeepApart(doc: ClassroomDocument, a: string, b: string): ClassroomDocument {
  return { ...doc, keepApart: doc.keepApart.filter((pair) => !isPair(pair, a, b)) };
}

/** The ids of the students `id` is kept apart from. */
export function partnersOf(doc: ClassroomDocument, id: string): string[] {
  return doc.keepApart
    .filter((pair) => pair.a === id || pair.b === id)
    .map((pair) => (pair.a === id ? pair.b : pair.a));
}

export function nameOf(doc: ClassroomDocument, id: string): string {
  return doc.students.find((student) => student.id === id)?.name ?? '';
}

export function setColorsEnabled(doc: ClassroomDocument, enabled: boolean): ClassroomDocument {
  return { ...doc, colors: { ...doc.colors, enabled } };
}

export function updateColorTag(
  doc: ClassroomDocument,
  index: number,
  change: Partial<{ name: string; inUse: boolean }>,
): ClassroomDocument {
  // Commas and the like would split the tag when names are written back as lines ("Ava, 2, Quiet front").
  const cleaned = change.name === undefined ? undefined : storableText(change.name).replace(/[,;|\t]/g, ' ').replace(/\s+/g, ' ');
  const name = cleaned === undefined ? undefined : fitText(cleaned, MAX_TAG_NAME_LENGTH).trim();
  // A tag needs a name; one left empty (e.g. only invisible characters) keeps the old one.
  if (name === '') return doc;
  const fitted = name === undefined ? change : { ...change, name };
  const tags = doc.colors.tags.map((tag, i) => (i === index ? { ...tag, ...fitted } : tag));
  return { ...doc, colors: { ...doc.colors, tags } };
}

export function setFirstNamesOnly(doc: ClassroomDocument, on: boolean): ClassroomDocument {
  return { ...doc, settings: { ...doc.settings, firstNamesOnly: on } };
}

/** Students whose first or any later name starts with what was typed, ignoring case and accents. */
export function findStudents(students: DocStudent[], typed: string, limit = 5): DocStudent[] {
  const query = foldName(typed.trim());
  if (!query) return [];
  const startsWith = (student: DocStudent) => foldName(student.name).startsWith(query);
  const wordStartsWith = (student: DocStudent) =>
    foldName(student.name)
      .split(' ')
      .some((word) => word.startsWith(query));
  const best = students.filter(startsWith);
  const more = students.filter((student) => !startsWith(student) && wordStartsWith(student));
  return [...best, ...more].slice(0, limit);
}

/** The one student whose whole name matches what was typed, if any. */
export function exactStudent(students: DocStudent[], typed: string): DocStudent | undefined {
  const matches = students.filter((student) => sameName(student.name, typed));
  return matches.length === 1 ? matches[0] : undefined;
}
