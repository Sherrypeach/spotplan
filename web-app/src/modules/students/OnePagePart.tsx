import { IconPlus } from '@tabler/icons-react';
import { useId, useState } from 'react';

import { Button } from '@components/Button';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocStudent } from '@modules/classroom/document';
import { LEVEL_STAMP, LEVELS } from '@modules/classroom/levels';
import { fillMissingLevels, setLevel } from '@modules/classroom/rosterEdits';
import type { Level } from '@modules/seating/engine/types';
import { ExtrasPart } from '@modules/students/ExtrasPart';
import { LevelsExplained } from '@modules/students/LevelsExplained';
import { NamesPart } from '@modules/students/NamesPart';

type Props = {
  /** The names notebook's text, kept by StudentsStep (see NamesPart). */
  text: string;
  onTextChange: (text: string | ((latest: string) => string)) => void;
};

const byName = (a: DocStudent, b: DocStudent) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** One row: the name, and 1 · 2 · 3 as radio buttons (arrow keys move between them). */
function LevelRow({ student, onChange }: { student: DocStudent; onChange: (level: Level) => void }) {
  const groupName = useId();
  return (
    <li className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b-2 border-line py-2 last:border-b-0">
      <span id={`${groupName}-label`} className="min-w-0 text-lg font-medium">
        {student.name}
      </span>
      <div role="radiogroup" aria-labelledby={`${groupName}-label`} className="flex gap-2">
        {LEVELS.map(({ level, name }) => {
          const checked = student.level === level;
          return (
            <label key={level} title={name} className="cursor-pointer">
              <input
                type="radio"
                name={groupName}
                className="peer sr-only"
                checked={checked}
                onChange={() => onChange(level)}
              />
              <span className="sr-only">
                {level}, {name}
              </span>
              <span
                aria-hidden
                className={`flex size-11 items-center justify-center rounded-full border-2 text-lg font-semibold transition peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage ${
                  checked ? `${LEVEL_STAMP[level]} border-transparent` : 'border-field-border bg-card text-ink-muted hover:border-sage-line'
                }`}
              >
                {level}
              </span>
            </label>
          );
        })}
      </div>
    </li>
  );
}

/**
 * Step 1 on a single page, for teachers who'd rather fill it in like a form:
 * names, then one row per student with 1 · 2 · 3, then the optional extras.
 */
export function OnePagePart({ text, onTextChange }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const [addingNames, setAddingNames] = useState(false);
  const levelsId = useId();

  const students = [...doc.students].sort(byName);
  const unleveled = students.filter((student) => student.level === null).length;
  const showNames = students.length === 0 || addingNames || text.trim() !== '';

  return (
    <div className="flex flex-col gap-6">
      {showNames ? (
        <NamesPart text={text} onTextChange={onTextChange} onAdded={() => setAddingNames(false)} onSkip={() => setAddingNames(false)} />
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setAddingNames(true)} data-tour="add-students">
          <IconPlus className="size-5" aria-hidden />
          Add more teammates
        </Button>
      )}

      {students.length > 0 && (
        <section aria-labelledby={levelsId} className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-card p-4">
          <h2 id={levelsId} className="text-xl font-semibold">
            Levels
          </h2>
          <LevelsExplained />
          {unleveled > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base" aria-live="polite">
                {unleveled} {unleveled === 1 ? 'teammate has' : 'teammates have'} no level yet.
              </p>
              <Button variant="secondary" onClick={() => update((current) => fillMissingLevels(current, 2))}>
                {unleveled === 1 ? 'Make them a 2' : 'Make them 2s'}
              </Button>
            </div>
          )}
          <ul className="flex flex-col">
            {students.map((student) => (
              <LevelRow
                key={student.id}
                student={student}
                onChange={(level) => update((current) => setLevel(current, student.id, level))}
              />
            ))}
          </ul>
        </section>
      )}

      {students.length > 0 && <ExtrasPart />}
    </div>
  );
}
