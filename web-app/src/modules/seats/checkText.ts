import type { CheckItem, Level, NeedKind } from '@modules/seating/engine';
import { count } from '@shared/text';

// What each need asks for, as the end of "Kelly needs …" or "Kelly would like …".
const NEED_SEAT: Record<NeedKind, string> = {
  'near-front': 'a seat near the front',
  'face-front': 'a seat that faces the front',
  'close-to-teacher': 'a seat close to you',
  'near-door': 'a seat near the door',
  'helper-nearby': 'a 3 sitting next to them',
  'fewer-neighbors': 'a seat with fewer neighbors',
};

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

type Lookup = {
  nameOf: (studentId: string) => string;
  levelOf: (studentId: string) => Level;
  labelOf: (seatId: string) => Level;
};

/** A check list item as a plain sentence, e.g. "Kelly is a 1 sitting in a 3 seat." */
export function checkSentence(item: CheckItem, { nameOf, levelOf, labelOf }: Lookup): string {
  const names = item.studentIds.map(nameOf);
  const who = list(names);
  const have = item.counts?.have ?? 0;
  const need = item.counts?.need ?? 0;
  const wouldLike = item.counts?.wouldLike ?? 0;
  const fronts = have === 0 ? 'No seats face the front' : `Only ${count(have, 'seat')} ${have === 1 ? 'faces' : 'face'} the front`;
  const asks = item.need ? NEED_SEAT[item.need] : 'something';
  switch (item.kind) {
    case 'more-students-than-seats':
      return have === 0 ? 'You haven’t added any seats yet.' : `There are ${count(need, 'teammate')} but only ${count(have, 'seat')}.`;
    case 'no-level':
      return `${who} doesn’t have a level yet.`;
    case 'unseated':
      return `${who} doesn’t have a seat.`;
    case 'one-outside-one-seat':
      return `${who} is a 1 sitting in a ${labelOf(item.seatIds[0])} seat.`;
    case 'must-need-unmet':
      return `${who} needs ${asks}.`;
    case 'ones-side-by-side':
      return `${who} are both 1s, sitting right next to each other.`;
    case 'keep-apart-together':
      return `${who} should be kept apart, but they sit near each other.`;
    case 'too-few-front-seats':
      return `${fronts}, but ${count(need, 'teammate')} ${need === 1 ? 'needs' : 'need'} to${wouldLike > 0 ? ` (and ${wouldLike} more would like to)` : ''}.`;
    case 'two-in-three-seat':
      return `${who} is a 2 sitting in a 3 seat.`;
    case 'two-beside-one-far': {
      const two = item.studentIds.find((id) => levelOf(id) === 2) ?? item.studentIds[0];
      const one = item.studentIds.find((id) => id !== two) ?? item.studentIds[1];
      return `${nameOf(two)} (a 2) sits next to ${nameOf(one)} (a 1), far from you.`;
    }
    case 'group-mostly-ones':
      return `${names[0]}’s table is mostly 1s.`;
    case 'group-without-three':
      return `${names[0]}’s table has no 3s.`;
    case 'no-door':
      return `${who} ${names.length === 1 ? 'needs' : 'need'} to sit near the door, but your room doesn’t have a door yet.`;
    case 'nice-need-unmet':
      return `${who} would like ${asks}.`;
    case 'front-seats-short-for-nice':
      return need > 0
        ? `${fronts}: ${count(need, 'teammate')} ${need === 1 ? 'needs' : 'need'} one and ${wouldLike} more would like one.`
        : `${fronts}, and ${count(wouldLike, 'teammate')} would like one.`;
  }
}
