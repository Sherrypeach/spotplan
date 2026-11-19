import { useId, useState } from 'react';

import { Button } from '@components/Button';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import { addKeepApart, isKeptApart, MAX_KEEP_APART, nameOf, removeKeepApart } from '@modules/classroom/rosterEdits';

const SELECT_CLASS = 'min-h-11 w-full min-w-0 cursor-pointer rounded-xl border-2 border-field-border bg-card px-3 text-base sm:w-auto';

/** Pairs who shouldn't sit together: pick two students, add the pair. */
export function KeepApartSection() {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const firstId = useId();
  const secondId = useId();
  const [firstPick, setFirst] = useState('');
  const [secondPick, setSecond] = useState('');
  const [message, setMessage] = useState('');

  // A pick that was removed from the class (or is the same student twice) counts as no pick.
  const inClass = (id: string) => doc.students.some((student) => student.id === id);
  const first = inClass(firstPick) ? firstPick : '';
  const second = inClass(secondPick) && secondPick !== first ? secondPick : '';
  const full = doc.keepApart.length >= MAX_KEEP_APART;
  // Where focus goes after adding or removing, so it never falls back to the top of the page.
  const focusFirstSelect = () => requestAnimationFrame(() => document.getElementById(firstId)?.focus());

  const handleAdd = () => {
    if (!first || !second || first === second) return;
    if (isKeptApart(doc, first, second)) {
      setMessage(`${nameOf(doc, first)} and ${nameOf(doc, second)} are already kept apart.`);
      return;
    }
    update((current) => addKeepApart(current, first, second));
    setMessage(`${nameOf(doc, first)} and ${nameOf(doc, second)} will sit apart.`);
    setFirst('');
    setSecond('');
    focusFirstSelect();
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="text-xl font-semibold">Keep teammates apart</h2>
      <p className="text-base text-ink-muted">Two teammates who shouldn’t sit next to each other.</p>
      {full ? (
        <p className="text-base">You’ve reached the limit of {MAX_KEEP_APART} pairs. Remove one to add another.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={firstId} className="sr-only">
            First teammate
          </label>
          <select id={firstId} value={first} onChange={(event) => setFirst(event.target.value)} className={SELECT_CLASS}>
            <option value="">Pick a teammate</option>
            {doc.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <span className="text-base">and</span>
          <label htmlFor={secondId} className="sr-only">
            Second teammate
          </label>
          <select id={secondId} value={second} onChange={(event) => setSecond(event.target.value)} className={SELECT_CLASS}>
            <option value="">Pick a teammate</option>
            {doc.students
              .filter((student) => student.id !== first)
              .map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
          </select>
          <Button variant="secondary" onClick={handleAdd} disabled={!first || !second}>
            Keep apart
          </Button>
        </div>
      )}
      <p className="text-base text-title" role="status">
        {message}
      </p>
      {doc.keepApart.length > 0 && (
        <ul className="flex flex-col gap-1">
          {doc.keepApart.map((pair) => (
            <li key={`${pair.a}-${pair.b}`} className="flex min-h-11 items-center justify-between rounded-xl bg-hover px-3 text-base">
              <span>
                {nameOf(doc, pair.a)} and {nameOf(doc, pair.b)}
              </span>
              <button
                type="button"
                onClick={() => {
                  update((current) => removeKeepApart(current, pair.a, pair.b));
                  setMessage(`${nameOf(doc, pair.a)} and ${nameOf(doc, pair.b)} can sit together again.`);
                  focusFirstSelect();
                }}
                className="min-h-11 cursor-pointer rounded-lg px-2 font-medium text-danger hover:bg-danger/5"
              >
                Remove<span className="sr-only">: {nameOf(doc, pair.a)} and {nameOf(doc, pair.b)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
