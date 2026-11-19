import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import { Button } from '@components/Button';
import type { DocStudent } from '@modules/classroom/document';
import type { AddPlan } from '@modules/classroom/rosterEdits';
import type { RosterEntry } from '@modules/classroom/rosterImport';
import { LevelStamp } from '@modules/students/LevelStamp';
import { MAX_STUDENTS } from '@shared/serverLimits';

// More than a class can hold isn't worth drawing; the rest is summed up in a line.
const VISIBLE_ROWS = 9;

type Props = {
  entries: RosterEntry[];
  /** What adding each entry would do, from planAdd. */
  plan: AddPlan[];
  /** Who's in the class already, each with a way to take them out. */
  students: DocStudent[];
  onRemove: (id: string) => void;
};

const NOTES: Record<AddPlan['status'], string | null> = {
  new: null,
  alreadyIn: 'already in your team',
  classFull: 'team is full',
};

/** Exactly who will be added, before the teacher clicks "Add". */
export function NamesPreview({ entries, plan, students, onRemove }: Props) {
  const toAdd = plan.filter((step) => step.status === 'new').length;
  const shown = plan.slice(0, MAX_STUDENTS);
  const more = plan.length - shown.length;
  const count = plan.length > 0 ? `: ${toAdd} ${toAdd === 1 ? 'teammate' : 'teammates'} to add` : '';

  return (
    <section aria-label="Preview" className="flex flex-col gap-2 self-start rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="text-base font-semibold">
        Preview{count}
      </h2>
      {plan.length === 0 ? (
        <p className="text-base text-ink-muted">New names show up here as you type.</p>
      ) : (
        // Lines are 2.25rem tall, so the list stops on a whole name; past that it
        // fades at the bottom to show there's more to scroll to.
        <ul
          className={`flex max-h-[20.25rem] flex-col overflow-y-auto pr-1 ${
            plan.length > VISIBLE_ROWS ? '[mask-image:linear-gradient(to_bottom,black_85%,transparent)]' : ''
          }`}
        >
          {shown.map((step, index) => {
            const note = NOTES[step.status];
            return (
              <li key={`${step.name}-${index}`} className="flex h-9 shrink-0 items-center gap-2 text-base">
                <LevelStamp level={entries[index].level} size="sm" announce />
                <span className={`min-w-0 truncate ${note ? 'text-ink-muted line-through' : ''}`}>{step.name}</span>
                {note && <span className="shrink-0 text-sm text-ink-muted">{note}</span>}
              </li>
            );
          })}
          {more > 0 && <li className="py-2 text-base text-ink-muted">and {more} more</li>}
        </ul>
      )}
      {students.length > 0 && <ClassList students={students} onRemove={onRemove} />}
    </section>
  );
}

/** The class as it is now, A to Z, each name with a bin to take them out (after a yes). */
function ClassList({ students, onRemove }: { students: DocStudent[]; onRemove: (id: string) => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="mt-2 flex flex-col gap-1 border-t-2 border-line pt-3">
      <h3 className="text-base font-semibold">Your team · {students.length}</h3>
      <ul className={`flex max-h-[20.25rem] flex-col overflow-y-auto pr-1 ${sorted.length > VISIBLE_ROWS ? '[mask-image:linear-gradient(to_bottom,black_85%,transparent)]' : ''}`}>
        {sorted.map((student) =>
          asking === student.id ? (
            <li key={student.id} role="group" aria-label={`Remove ${student.name}?`} className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg bg-sage-mist p-2 text-base">
              <span className="min-w-0 flex-1">Remove {student.name}?</span>
              <Button
                variant="danger"
                autoFocus
                onClick={() => {
                  setAsking(null);
                  onRemove(student.id);
                }}
              >
                Yes, remove
              </Button>
              <Button variant="secondary" onClick={() => setAsking(null)}>
                Cancel
              </Button>
            </li>
          ) : (
            <li key={student.id} className="flex h-11 shrink-0 items-center gap-2 text-base">
              <span className="min-w-0 flex-1 truncate">{student.name}</span>
              <button
                type="button"
                onClick={() => setAsking(student.id)}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-hover"
              >
                <IconTrash className="size-5" aria-hidden />
                <span className="sr-only">Remove {student.name}</span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
