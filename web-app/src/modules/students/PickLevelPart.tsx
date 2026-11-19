import { IconBasket } from '@tabler/icons-react';
import { useId, useState } from 'react';

import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocStudent } from '@modules/classroom/document';
import { LEVEL_BASKET, LEVEL_PICKED, levelName } from '@modules/classroom/levels';
import { setLevel } from '@modules/classroom/rosterEdits';
import type { Level } from '@modules/seating/engine/types';
import { LevelStamp } from '@modules/students/LevelStamp';
import { TypeToPick } from '@modules/students/TypeToPick';
import { useChipDrag, type DropZone } from '@modules/students/useChipDrag';

type Props = {
  /** The level a tap gives: 1 for "extra support", 3 for "sit anywhere". */
  level: Level;
  hint: string;
};

const byName = (a: DocStudent, b: DocStudent) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// select-none and no callout: holding a name on a tablet starts a drag, not a text selection.
const CHIP =
  'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 pr-5 text-lg font-medium transition select-none [-webkit-touch-callout:none]';

/**
 * The students picked for `level` in a box at the top, everyone else A to Z
 * below. A tap (or typing a name) moves a student up; a tap in the box moves
 * them back.
 */
export function PickLevelPart({ level, hint }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  // Taking someone out puts back the level they had before (e.g. a 3 from the pasted list), not none.
  const [before, setBefore] = useState<Record<string, Level | null>>({});
  const restId = useId();

  const picked = doc.students.filter((student) => student.level === level).sort(byName);
  const others = doc.students.filter((student) => student.level !== level).sort(byName);
  // A 1 stays a 1 while picking the 3s; it's changed when checking the class.
  const locked = (student: DocStudent) => level === 3 && student.level === 1;
  const hasOnes = others.some(locked);

  const pick = (student: DocStudent) => {
    setBefore((saved) => ({ ...saved, [student.id]: student.level }));
    update((current) => setLevel(current, student.id, level));
  };
  const unpick = (student: DocStudent) => update((current) => setLevel(current, student.id, before[student.id] ?? null));

  // Dragging a name into the basket picks them; dragging it out puts them back.
  const { drag, chipProps, ghostRef } = useChipDrag((id: string, zone: DropZone) => {
    const student = doc.students.find((s) => s.id === id);
    if (!student || locked(student)) return;
    if (zone === 'basket') pick(student);
    else unpick(student);
  });
  const overBasket = drag?.over === 'basket';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink-muted">{hint}</p>

      <section
        aria-label={levelName(level)}
        data-drop-zone="basket"
        className={`flex min-h-32 flex-col gap-3 rounded-2xl border-3 border-dashed p-3 transition ${LEVEL_BASKET[level]} ${
          overBasket ? 'ring-4 ring-action-soft' : ''
        }`}
      >
        <header className="flex items-center gap-2">
          <IconBasket className="size-6 text-ink-muted" aria-hidden />
          <LevelStamp level={level} size="sm" />
          <h2 className="text-base font-semibold">
            {levelName(level)} · <span aria-live="polite">{picked.length}</span>
          </h2>
        </header>
        {picked.length === 0 ? (
          <p className="text-base text-ink-muted">No one here yet. Tap a name below, drag it here, or type it.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {picked.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  aria-pressed
                  {...chipProps(student.id, student.name, 'basket')}
                  onClick={() => unpick(student)}
                  className={`${CHIP} pl-2 ${LEVEL_PICKED[level]}`}
                >
                  <LevelStamp level={level} size="sm" />
                  {student.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TypeToPick students={others.filter((student) => !locked(student))} onPick={pick} />

      <section aria-labelledby={restId} data-drop-zone="rest" className="flex flex-col gap-2 rounded-2xl">
        <h2 id={restId} className="text-base font-medium text-ink-muted">
          The rest of your team, A to Z
        </h2>
        {hasOnes && <p className="text-base text-ink-muted">Faded names are your 1s. You can change them when you check your team.</p>}
        <ul className="flex flex-wrap gap-2">
          {others.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                aria-pressed={false}
                disabled={locked(student)}
                {...(locked(student) ? {} : chipProps(student.id, student.name, 'rest'))}
                onClick={() => pick(student)}
                className={`${CHIP} border-field-border bg-card pl-5 hover:border-sage-line disabled:cursor-default disabled:opacity-35`}
              >
                {student.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* The name following the pointer while it's dragged. */}
      {drag && (
        <div
          ref={ghostRef}
          aria-hidden
          className={`${CHIP} pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 border-sage bg-card pl-5 shadow-lg`}
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.name}
        </div>
      )}
    </div>
  );
}
