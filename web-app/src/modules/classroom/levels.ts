import type { Level, NeedKind } from '@modules/seating/engine/types';

// The level and need wording lives in one place, so it can change without touching the screens.
export const LEVELS: { level: Level; name: string; description: string }[] = [
  {
    level: 1,
    name: 'Needs close support',
    description:
      'New hires, people still ramping up, or anyone who works best with you nearby. Also anyone with an accessibility or health need you want to keep in mind.',
  },
  {
    level: 2,
    name: 'Mostly independent',
    description:
      'Gets the work done, but can get pulled into side conversations. Does best with the right neighbors.',
  },
  {
    level: 3,
    name: 'Could sit anywhere',
    description:
      'Fully independent and focused. Could sit next to almost anyone and still do great work.',
  },
];

export function levelName(level: Level): string {
  return LEVELS[level - 1].name;
}

/** Tailwind classes for a level's stamp: soft red 1, yellow 2, green 3. */
export const LEVEL_STAMP: Record<Level, string> = {
  1: 'bg-level-1 text-stamp-ink',
  2: 'bg-level-2 text-stamp-ink',
  3: 'bg-level-3 text-stamp-ink',
};

/**
 * Tailwind classes for a student picked for a level: a soft tint of the
 * level's color (with its stamp inside), so it never looks like the peach
 * main button.
 */
export const LEVEL_PICKED: Record<Level, string> = {
  1: 'border-level-1 bg-level-1/25',
  2: 'border-level-2 bg-level-2/30',
  3: 'border-level-3 bg-level-3/25',
};

/** Tailwind classes for a level's basket: dashed border and a light tint. */
export const LEVEL_BASKET: Record<Level, string> = {
  1: 'border-level-1 bg-level-1/15',
  2: 'border-level-2 bg-level-2/20',
  3: 'border-level-3 bg-level-3/15',
};

export const NEEDS: { kind: NeedKind; label: string; explain: string }[] = [
  { kind: 'near-front', label: 'Needs to sit near the front', explain: 'A seat toward the front of the room, e.g. near the screen for presentations.' },
  { kind: 'face-front', label: 'Needs to face the screen', explain: 'A seat that faces the front screen or whiteboard.' },
  { kind: 'close-to-teacher', label: 'Needs to be close to me', explain: 'Among the seats closest to where you usually work.' },
  { kind: 'near-door', label: 'Needs to be near the door', explain: 'For easy access, frequent calls or mobility.' },
  { kind: 'helper-nearby', label: 'Needs a buddy nearby', explain: 'At least one 3 sits right next to them, like a mentor.' },
  { kind: 'fewer-neighbors', label: 'Needs a quieter spot', explain: 'Fewer than 3 teammates sit right next to them.' },
];

/** The four color tags' swatches, in order. Their names are the teacher's. */
export const COLOR_SWATCHES = ['bg-tag-pink', 'bg-tag-orange', 'bg-tag-blue', 'bg-tag-purple'];

/** An answer to a "Help me decide" question: a level and why, or on to the next question. */
export type HelpAnswer = { level: Level; why: string } | 'next';

/**
 * "Help me decide": up to four yes or no questions for teachers new to
 * leveling. The first answer that settles it ends them.
 */
export const HELP_QUESTIONS: { ask: (name: string) => string; examples: string; yes: HelpAnswer; no: HelpAnswer }[] = [
  {
    ask: (name) => `Is ${name} new to the team, or do they have an accessibility or health need to keep in mind?`,
    examples: 'First weeks on the job, vision or hearing needs, mobility, anything they asked you to accommodate.',
    yes: { level: 1, why: 'is new or has a need to keep in mind' },
    no: 'next',
  },
  {
    ask: (name) => `Does ${name} work best with you close by?`,
    examples: 'Still learning the ropes, asks lots of questions, or stays on track best with quick check-ins.',
    yes: { level: 1, why: 'works best with you close by' },
    no: 'next',
  },
  {
    ask: (name) => `Does ${name} get pulled into side conversations by the people around them?`,
    examples: 'Chats with neighbors, joins nearby calls, or follows what others are doing.',
    yes: { level: 2, why: 'gets pulled into side conversations' },
    no: 'next',
  },
  {
    ask: (name) => `Could ${name} sit next to almost anyone and still do great work?`,
    examples: 'Stays focused even next to friends or chatty teammates.',
    yes: { level: 3, why: 'could sit next to almost anyone and do well' },
    no: { level: 2, why: 'does best with the right neighbors' },
  },
];
