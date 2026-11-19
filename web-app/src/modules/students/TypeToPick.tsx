import { useId, useState, type KeyboardEvent } from 'react';

import type { DocStudent } from '@modules/classroom/document';
import { findStudents } from '@modules/classroom/rosterEdits';

type Props = {
  /** Who can be picked by typing (not those already picked or locked). */
  students: DocStudent[];
  onPick: (student: DocStudent) => void;
};

const INPUT_LOOK = 'min-h-12 w-full rounded-xl border-2 px-4 text-lg';

/**
 * Type the first letters of a name and the rest appears in light gray;
 * Enter picks that student, Tab or → fills the name in.
 */
export function TypeToPick({ students, onPick }: Props) {
  const inputId = useId();
  const statusId = useId();
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState('');

  const match = typed.trim() ? findStudents(students, typed, 1)[0] : undefined;
  // The gray ending shows only when the name starts with what was typed;
  // a match on a later name ("sil" → Hugo Silva) is named beside the box instead.
  const startsWithTyped = match ? match.name.toLowerCase().startsWith(typed.toLowerCase()) : false;
  const ghost = match && startsWithTyped ? match.name.slice(typed.length) : '';

  const pick = () => {
    if (!match) {
      setMessage(typed.trim() ? `No one left called “${typed.trim()}”.` : 'Type the first letters of a name.');
      return;
    }
    onPick(match);
    setMessage(`${match.name} picked.`);
    setTyped('');
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pick();
    } else if ((event.key === 'Tab' || event.key === 'ArrowRight') && ghost && !event.shiftKey) {
      event.preventDefault();
      setTyped(match!.name);
    } else if (event.key === 'Escape') {
      setTyped('');
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-base font-medium">
        Type a name
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          {/* What was typed (invisible) followed by the rest of the name, in gray, under the input. */}
          <div aria-hidden className={`${INPUT_LOOK} pointer-events-none absolute inset-0 flex items-center overflow-hidden border-transparent whitespace-pre`}>
            <span className="invisible">{typed}</span>
            <span className="text-ink-muted/60">{ghost}</span>
          </div>
          <input
            id={inputId}
            role="combobox"
            aria-autocomplete="inline"
            aria-expanded={false}
            aria-describedby={statusId}
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setMessage('');
            }}
            onKeyDown={handleKey}
            className={`${INPUT_LOOK} relative border-field-border bg-transparent focus:border-sage`}
          />
        </div>
        {match && !startsWithTyped && <span className="text-base text-ink-muted">→ {match.name}</span>}
        {/* Beside the box, not under it, so it takes no extra room. */}
        <span id={statusId} className="text-sm text-ink-muted" role="status">
          {message || (match ? `Enter to pick ${match.name}.` : '')}
        </span>
      </div>
    </div>
  );
}
