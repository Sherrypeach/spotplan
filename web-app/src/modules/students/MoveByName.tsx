import { useId, useRef, useState, type KeyboardEvent } from 'react';

import type { DocStudent } from '@modules/classroom/document';
import { levelName, LEVEL_STAMP } from '@modules/classroom/levels';
import { exactStudent, findStudents } from '@modules/classroom/rosterEdits';
import type { Level } from '@modules/seating/engine/types';

const LEVEL_CHOICES: Level[] = [1, 2, 3];

type Props = {
  students: DocStudent[];
  onMove: (studentId: string, level: Level) => void;
};

/**
 * For teachers who'd rather type: start a name, pick it from the list (click
 * or Enter), then pick 1, 2 or 3.
 */
export function MoveByName({ students, onMove }: Props) {
  const inputId = useId();
  const listId = useId();
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<DocStudent | null>(null);
  const [active, setActive] = useState(0);
  // Escape closes the list until the teacher types again.
  const [dismissed, setDismissed] = useState(false);
  const [hint, setHint] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const firstLevelRef = useRef<HTMLButtonElement>(null);

  const matches = chosen || dismissed ? [] : findStudents(students, typed);
  // The level buttons work once a student is picked or a whole name typed; until then they look empty.
  const ready = Boolean(chosen ?? exactStudent(students, typed));
  const open = matches.length > 0;

  const choose = (student: DocStudent) => {
    setChosen(student);
    setTyped(student.name);
    requestAnimationFrame(() => firstLevelRef.current?.focus());
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setDismissed(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(matches[Math.min(active, matches.length - 1)]);
    }
  };

  const move = (level: Level) => {
    // A whole name typed out counts, even if it wasn't picked from the list.
    const student = chosen ?? exactStudent(students, typed);
    if (!student) {
      setHint('Type or pick a name first.');
      inputRef.current?.focus();
      return;
    }
    setHint('');
    onMove(student.id, level);
    setChosen(null);
    setTyped('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className="text-lg font-semibold">
          Move
        </label>
        <div className="relative w-full sm:w-56">
          <input
            id={inputId}
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder="Type a name"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setChosen(null);
              setDismissed(false);
              setHint('');
              setActive(0);
            }}
            onKeyDown={handleKey}
            className="min-h-12 w-full rounded-xl border-2 border-field-border bg-card px-4 text-lg placeholder:text-ink-muted/75 focus:border-sage"
          />
          {open && (
            <ul id={listId} role="listbox" className="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-xl border-2 border-sage-line bg-card">
              {matches.map((student, index) => (
                <li
                  key={student.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(student)}
                  className={`cursor-pointer px-4 py-2 text-lg ${index === active ? 'bg-sage-soft font-semibold text-sage-ink' : ''}`}
                >
                  {student.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="text-lg font-semibold">to</span>
        <div className="flex gap-2">
          {LEVEL_CHOICES.map((level, index) => (
            <button
              key={level}
              ref={index === 0 ? firstLevelRef : undefined}
              type="button"
              onClick={() => move(level)}
              aria-disabled={!ready || undefined}
              aria-label={`Level ${level}, ${levelName(level)}`}
              className={`size-12 cursor-pointer rounded-full text-lg font-semibold ${LEVEL_STAMP[level]} ${ready ? '' : 'border-2 border-dashed border-field-border bg-card!'}`}
            >
              {level}
            </button>
          ))}
        </div>
        {/* Beside the buttons, not under them, so the box stays one row high. */}
        <span className="text-base text-ink-muted" role="status">
          {hint}
        </span>
      </div>
    </div>
  );
}
