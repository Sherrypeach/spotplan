import { fitText, storableText } from '@shared/text';
import { MAX_NAME_LENGTH } from '@modules/classroom/rosterLimits';

const MAX_RAW_LENGTH = 200;
// Characters trimmed from both ends of a name.
const EDGE_PUNCTUATION = new Set([' ', '.', ',', ';', ':', '-', '–', '—']);
const TRAILING_PUNCTUATION = new Set([' ', ',', ';', ':', '-', '–', '—']);

// Generational suffixes: kept in the name, never used as the last-name initial.
export const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
// A generational numeral at the end of a name ("John Smith III") stays in capitals.
const GENERATION_NUMERAL = /^(?:ii|iii|iv)$/i;

/** Normalizes pasted text: control characters, odd spaces, invisible characters and curly quotes. */
export function normalizeText(text: string): string {
  return storableText(text)
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\r\n?/g, '\n');
}

function capitalize(word: string): string {
  // Each part of "mary-kate" or "o'brien" gets a capital.
  return word.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

/**
 * "AVA ROSSI" and "ava rossi" become "Ava Rossi". A name typed with any
 * capitals of its own ("Ana María de la Cruz", "DeShawn McDonald") stays as typed.
 */
function fixCase(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, '');
  const allUpper = letters.length > 1 && letters === letters.toUpperCase();
  const allLower = letters === letters.toLowerCase();
  if (!allUpper && !allLower) return name;
  return name
    .split(' ')
    .map((word, index, words) => {
      const isLast = index > 0 && index === words.length - 1;
      return isLast && GENERATION_NUMERAL.test(word) ? word.toUpperCase() : capitalize(word);
    })
    .join(' ');
}

/** Trims characters from both ends with a plain loop, which stays quick on long junk cells. */
function trimEdges(text: string, start: Set<string>, end: Set<string>): string {
  let from = 0;
  let to = text.length;
  while (from < to && start.has(text[from])) from++;
  while (to > from && end.has(text[to - 1])) to--;
  return text.slice(from, to);
}

/**
 * Cleans one name: a nickname in quotes or parentheses replaces the first
 * name ("Alexander (Alex) Smith" → "Alex Smith"), stray punctuation goes,
 * and all-caps or all-lowercase names get normal capitals.
 */
export function cleanName(raw: string): string {
  // No real name is longer; cutting first keeps odd cells quick.
  let name = raw.slice(0, MAX_RAW_LENGTH).replace(/\s+/g, ' ').trim();
  // Only a word or two of letters counts as a nickname, not "(left in March)".
  const nickname = name.match(/^(\S+)\s+["(]([\p{L}'-]+(?: [\p{L}'-]+)?)[")]\s*(.*)$/u);
  if (nickname) name = `${nickname[2]} ${nickname[3]}`.trim();
  name = trimEdges(name.replace(/["()[\]{}<>]/g, '').replace(/\s/g, ' '), EDGE_PUNCTUATION, TRAILING_PUNCTUATION);
  // A full stop after a word goes ("Chloe."), after an initial or a suffix it stays ("Chloe M.", "John Smith Jr.").
  const lastWord = name.slice(name.lastIndexOf(' ') + 1);
  if (!SUFFIXES.has(lastWord.toLowerCase())) name = name.replace(/(\p{L}{2,})\.$/u, '$1');
  name = name.replace(/\s+/g, ' ').trim();
  return fitText(fixCase(name), MAX_NAME_LENGTH).trim();
}

/** "Rossi, Ava" (last name first) → "Ava Rossi"; "Smith, John Jr." → "John Smith Jr.". */
export function lastFirst(last: string, first: string): string {
  const words = first.trim().split(/\s+/);
  const suffix = words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase()) ? words.pop() : undefined;
  return [words.join(' '), last.trim(), suffix].filter(Boolean).join(' ');
}

/** The first name, and the last name used for an initial (skipping "Jr." and the like). */
export function nameParts(name: string): { first: string; last: string } {
  const words = name.split(' ');
  const rest = words.slice(1).filter((word) => !SUFFIXES.has(word.toLowerCase()));
  return { first: words[0], last: rest[rest.length - 1] ?? '' };
}

/** For comparing names: no accents, no case ("José" and "jose" match). */
export function foldName(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** "R." for "Rossi", or "Ro." when another student's last name also starts with R; the whole name once letters run out. */
function lastPart(last: string, letters: number): string {
  const part = last.replace(/\.$/, '');
  if (part.length === 1) return `${part.toUpperCase()}.`;
  // Already short ("Ro.") stays as it is.
  if (letters >= part.length) return last;
  return `${part.slice(0, letters).toUpperCase().slice(0, 1)}${part.slice(1, letters)}.`;
}

/**
 * First names only, keeping enough of the last name to tell students apart
 * when they share a first name ("Ava R." and "Ava C.", or "Ava Ro." and
 * "Ava Ru."). `taken` are names already in the class.
 */
export function firstNamesOnly(names: string[], taken: string[] = []): string[] {
  const parts = names.map(nameParts);
  const firstCounts = new Map<string, number>();
  for (const { first } of [...parts, ...taken.map(nameParts)]) {
    const key = foldName(first);
    firstCounts.set(key, (firstCounts.get(key) ?? 0) + 1);
  }
  return parts.map(({ first, last }, index) => {
    if (!last || (firstCounts.get(foldName(first)) ?? 0) < 2) return first;
    // One letter more until no other pasted student with this first name shares the start of the last name.
    let letters = 1;
    const mine = foldName(last.replace(/\.$/, ''));
    for (const [other, { first: otherFirst, last: otherLast }] of parts.entries()) {
      const theirs = foldName(otherLast.replace(/\.$/, ''));
      if (other === index || foldName(otherFirst) !== foldName(first) || theirs === mine) continue;
      while (letters < mine.length && mine.slice(0, letters) === theirs.slice(0, letters)) letters++;
    }
    return `${first} ${lastPart(last, letters)}`;
  });
}
