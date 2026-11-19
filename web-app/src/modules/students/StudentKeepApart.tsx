import { useId, useState } from 'react';

import { Button } from '@components/Button';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocStudent } from '@modules/classroom/document';
import { addKeepApart, MAX_KEEP_APART, nameOf, partnersOf, removeKeepApart } from '@modules/classroom/rosterEdits';

type Props = {
  student: DocStudent;
};

/** The students this one shouldn't sit with, from their own panel. */
export function StudentKeepApart({ student }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const selectId = useId();
  const [pick, setPicked] = useState('');
  const headingId = useId();

  const partners = partnersOf(doc, student.id);
  const others = doc.students.filter((s) => s.id !== student.id && !partners.includes(s.id));
  const picked = others.some((other) => other.id === pick) ? pick : '';
  const full = doc.keepApart.length >= MAX_KEEP_APART;
  // After adding or removing, focus stays in this section instead of falling to the page.
  const refocus = () =>
    requestAnimationFrame(() => (document.getElementById(selectId) ?? document.getElementById(headingId))?.focus());

  const handleAdd = () => {
    if (!picked) return;
    update((current) => addKeepApart(current, student.id, picked));
    setPicked('');
    refocus();
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 id={headingId} tabIndex={-1} className="text-lg font-semibold">
        Keep apart from
      </h3>
      {partners.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {partners.map((id) => (
            <li key={id} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-line pr-1 pl-4 text-base">
              {nameOf(doc, id)}
              <button
                type="button"
                aria-label={`Let ${student.name} and ${nameOf(doc, id)} sit together`}
                onClick={() => {
                  update((current) => removeKeepApart(current, student.id, id));
                  refocus();
                }}
                className="flex size-9 cursor-pointer items-center justify-center rounded-full text-lg hover:bg-hover"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && <p className="text-base text-ink-muted">You’ve reached the limit of {MAX_KEEP_APART} pairs.</p>}
      {!full && others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            A teammate to keep apart from {student.name}
          </label>
          <select
            id={selectId}
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
            className="min-h-11 w-full min-w-0 cursor-pointer rounded-xl border-2 border-field-border bg-card px-3 text-base sm:w-auto"
          >
            <option value="">Pick a teammate</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={handleAdd} disabled={!picked}>
            Add
          </Button>
        </div>
      )}
    </section>
  );
}
