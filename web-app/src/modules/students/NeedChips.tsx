import { useState } from 'react';

import type { DocStudent } from '@modules/classroom/document';
import { NEEDS } from '@modules/classroom/levels';
import type { NeedKind } from '@modules/seating/engine/types';

type Props = {
  student: DocStudent;
  onCycle: (kind: NeedKind) => void;
};

const LOOKS = {
  off: 'border-2 border-field-border bg-card',
  must: 'border-2 border-step-room bg-step-room text-stamp-ink',
  nice: 'border-2 border-dashed border-step-room bg-step-room/10 text-step-room-ink',
};

const STATE_WORDS = { off: 'Off', must: 'Must', nice: 'Nice to have' };

/** The six needs as chips. Each tap: Off → Must → Nice to have → Off. */
export function NeedChips({ student, onCycle }: Props) {
  const [lastPicked, setLastPicked] = useState<NeedKind | null>(null);
  const explained = NEEDS.find((need) => need.kind === lastPicked);
  // Said with the new state, since a screen reader doesn't re-read a button's changed text.
  const picked = explained ? `${explained.label}: ${STATE_WORDS[student.needs[explained.kind] ?? 'off']}. ` : '';

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {NEEDS.map((need) => {
          const strength = student.needs[need.kind] ?? 'off';
          const prefix = strength === 'must' ? 'Must: ' : strength === 'nice' ? 'Nice to have: ' : '';
          return (
            <li key={need.kind}>
              <button
                type="button"
                onClick={() => {
                  onCycle(need.kind);
                  setLastPicked(need.kind);
                }}
                className={`min-h-11 cursor-pointer rounded-full px-4 text-left text-base font-medium ${LOOKS[strength]}`}
              >
                {prefix}
                {need.label}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-base text-ink-muted" aria-live="polite">
        {explained ? `${picked}${explained.explain}` : 'Tap a need to make it a Must, tap again for Nice to have, once more to turn it off.'}
      </p>
    </div>
  );
}
