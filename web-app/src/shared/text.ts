/**
 * Control characters other than tab and newlines. Files saved in odd
 * encodings carry them, and the database refuses to store some of them.
 */
function isControlCharacter(code: number): boolean {
  const allowed = code === 0x09 || code === 0x0a || code === 0x0d;
  return !allowed && (code < 0x20 || code === 0x7f);
}

/** Half of an emoji (or another character that needs two code units) on its own. */
function isLoneSurrogate(text: string, index: number): boolean {
  const code = text.charCodeAt(index);
  const high = code >= 0xd800 && code <= 0xdbff;
  const low = code >= 0xdc00 && code <= 0xdfff;
  if (high) {
    const next = text.charCodeAt(index + 1);
    return !(next >= 0xdc00 && next <= 0xdfff);
  }
  if (low) {
    const previous = text.charCodeAt(index - 1);
    return !(previous >= 0xd800 && previous <= 0xdbff);
  }
  return false;
}

/** Removes characters that can't be saved: control characters and broken halves of emoji. */
export function storableText(text: string): string {
  let clean = '';
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (!isControlCharacter(code) && !isLoneSurrogate(text, index)) clean += text[index];
  }
  return clean;
}

/**
 * Shortens text to at most `max` UTF-16 code units, the way the API counts,
 * without cutting an emoji or accented letter in half.
 */
export function fitText(text: string, max: number): string {
  if (text.length <= max) return text;
  let fitted = '';
  for (const character of text) {
    if (fitted.length + character.length > max) break;
    fitted += character;
  }
  return fitted;
}

/** "1 seat", "3 seats": a number with its word, singular or plural. */
export function count(number: number, word: string): string {
  return `${number} ${word}${number === 1 ? '' : 's'}`;
}

/** About how wide a Poppins letter is, as a share of the font size: to guess how much of a name fits. */
export const LETTER_WIDTH = 0.6;

// Poppins SemiBold's letter widths, in thousandths of the font size, for the
// characters from space (32) to tilde (126), read from the font file.
const POPPINS_SEMIBOLD = [
  238, 354, 364, 887, 654, 829, 778, 195, 485, 485, 518, 674, 254, 583, 260, 486, 646, 362, 574, 599, 661, 644, 640, 548, 643, 626, 263, 324, 584, 738, 567, 538,
  1051, 716, 643, 768, 717, 532, 530, 768, 717, 278, 570, 663, 459, 899, 735, 785, 608, 787, 641, 609, 577, 697, 711, 1024, 686, 636, 576, 497, 756, 496, 680,
  790, 271, 678, 678, 602, 678, 617, 345, 678, 661, 278, 278, 584, 278, 1048, 661, 638, 678, 678, 404, 545, 388, 661, 599, 844, 540, 605, 483, 508, 309, 508, 592,
];
const measured = new Map<string, number>();
const MEASURED_LIMIT = 2000;
// Letters outside that range (other alphabets, emoji) are taken as this wide, a little over a capital.
const WIDE_LETTER = 0.8;

/**
 * How wide text is in Poppins SemiBold at this font size. An accented letter
 * counts as its plain letter ("é" as "e"), so names are never cut short.
 */
export function textWidth(text: string, fontSize: number): number {
  let width = measured.get(text);
  if (width === undefined) {
    width = 0;
    for (const character of text) {
      const code = character.normalize('NFD').codePointAt(0) ?? 0;
      width += code >= 32 && code <= 126 ? POPPINS_SEMIBOLD[code - 32] / 1000 : WIDE_LETTER;
    }
    // The chart measures the same few names over and over while it looks for room.
    if (measured.size >= MEASURED_LIMIT) measured.clear();
    measured.set(text, width);
  }
  return width * fontSize;
}
