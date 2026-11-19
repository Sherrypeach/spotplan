import { nameParts } from '@modules/classroom/roster/names';
import { IconFileSpreadsheet, IconTrash } from '@tabler/icons-react';
import { useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@components/Button';
import { Notice } from '@components/Notice';
import { TextArea } from '@components/TextArea';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import { ROSTER_FILE_TYPES } from '@modules/classroom/roster/file';
import { addStudents, MAX_STUDENTS, planAdd, removeAllStudents, removeStudent, setFirstNamesOnly } from '@modules/classroom/rosterEdits';
import { parseRosterText, type RosterEntry } from '@modules/classroom/rosterImport';
import { entriesToText } from '@modules/students/namesText';
import { NamesPreview } from '@modules/students/NamesPreview';
import { useRosterFile } from '@modules/students/useRosterFile';

type Props = {
  /** The notebook's text lives in StudentsStep, so it survives hiding private info. */
  text: string;
  /** Takes the new text, or a function of the latest text (for a file that finishes loading later). */
  onTextChange: (text: string | ((latest: string) => string)) => void;
  onAdded: () => void;
  onSkip: () => void;
};

function studentCount(count: number): string {
  return `${count} ${count === 1 ? 'teammate' : 'teammates'}`;
}

function listNames(names: string[]): string {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Paste names, or bring in a spreadsheet; a preview shows who will be added. */
export function NamesPart({ text, onTextChange, onAdded, onSkip }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Parsing waits for typing to settle, so long pastes don't make the notebook lag.
  const settledText = useDeferredValue(text);
  const entries: RosterEntry[] = useMemo(() => parseRosterText(settledText, doc.colors.tags), [settledText, doc.colors.tags]);
  const plan = useMemo(() => planAdd(doc, entries), [doc, entries]);
  const toAdd = plan.filter((step) => step.status === 'new').length;
  const classFull = doc.students.length >= MAX_STUDENTS;
  const firstTagName = (doc.colors.tags.find((tag) => tag.inUse) ?? doc.colors.tags[0])?.name.toLowerCase() ?? 'blue';

  const showError = (message: string) => {
    setError(message);
    textRef.current?.focus();
  };

  // A spreadsheet's rows land in the notebook as lines, after anything already there,
  // so the teacher sees and can fix them.
  const file = useRosterFile({
    tags: doc.colors.tags,
    onRead: (rows, note) => {
      setError(undefined);
      const lines = entriesToText(rows, doc.colors.tags);
      // Appended to whatever is in the notebook now, including anything typed while the file loaded.
      onTextChange((latest) => (latest.trim() ? `${latest.trimEnd()}\n${lines}` : lines));
      setNotice(note);
    },
    onError: showError,
  });

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    void file.read(files).finally(() => {
      event.target.value = '';
    });
  };

  const handleAdd = () => {
    // The typed text, not the deferred one: the button never adds a stale list.
    const current = parseRosterText(text, doc.colors.tags);
    if (current.length === 0) {
      showError('Type or paste at least one name.');
      return;
    }
    const added = addStudents(doc, current);
    if (added.added > 0) update(() => added.doc);
    // Names that weren't added stay in the notebook, so nothing typed is lost.
    onTextChange(entriesToText(added.skipped, doc.colors.tags));
    setError(undefined);
    const skipped = [
      added.alreadyIn.length > 0 &&
        `${listNames(added.alreadyIn)} ${added.alreadyIn.length === 1 ? 'is' : 'are'} already in your team.${
          doc.settings.firstNamesOnly ? ` For a different teammate with the same name, type a last initial, like “${nameParts(added.alreadyIn[0]).first} C.”` : ''
        }`,
      added.classFull.length > 0 &&
        `A team can have up to ${MAX_STUDENTS} teammates, so ${studentCount(added.classFull.length)} weren’t added. They’re still in the notebook.`,
    ].filter(Boolean);
    setNotice(skipped.length > 0 ? skipped.join(' ') : null);
    // With names left over, stay here so the teacher sees why they weren't added.
    if (added.added > 0 && skipped.length === 0) onAdded();
  };

  return (
    <div className="flex flex-col gap-4">
      {doc.students.length > 0 && (
        <Notice>
          {classFull
            ? `Your team is full: a team can have up to ${MAX_STUDENTS} teammates.`
            : `Your team has ${studentCount(doc.students.length)}. Add more below, or`}{' '}
          <button
            type="button"
            onClick={onSkip}
            className="ml-1 inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-sage-line bg-card px-3 text-sm font-semibold text-sage-ink hover:bg-sage-mist"
          >
            Go to your team →
          </button>
        </Notice>
      )}
      {doc.students.length > 0 &&
        (confirmingRemove ? (
          <div role="group" aria-label="Remove every name?" className="flex flex-wrap items-center gap-2 rounded-xl bg-sage-mist p-3">
            <span className="flex-1 text-base">
              Are you sure? This removes all {studentCount(doc.students.length)}, their seats and your saved charts. The room stays.
            </span>
            <Button
              variant="danger"
              autoFocus
              onClick={() => {
                update((current) => removeAllStudents(current));
                setConfirmingRemove(false);
                setNotice('Every name is removed. Type or paste your team to start again.');
                textRef.current?.focus();
              }}
            >
              Yes, remove all
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmingRemove(false);
                requestAnimationFrame(() => removeRef.current?.focus());
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            ref={removeRef}
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 self-start text-base font-semibold text-sage-ink"
          >
            <IconTrash className="size-5" aria-hidden />
            Remove all names
          </button>
        ))}
      {/* Always on the page, so screen readers hear the message when it appears. */}
      {/* While empty it cancels its own gap, so it takes no room. */}
      <div aria-live="polite" className={notice ? '' : '-mb-4'}>
        {notice && <Notice live={false}>{notice}</Notice>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="flex flex-col gap-3 lg:order-1" data-tour="add-students" {...file.dropZone}>
          <TextArea
            ref={textRef}
            label="Names, one on each line"
            variant="notebook"
            hint={
              doc.colors.enabled
                ? `You can add a level and a color after a name, like: Noah, 3, ${firstTagName}. Or drop a spreadsheet here.`
                : 'You can add a level after a name, like: Noah, 3. Or drop a spreadsheet here.'
            }
            error={error}
            value={text}
            spellCheck={false}
            className={file.dragging ? '[&_textarea]:border-sage [&_textarea]:bg-sage-mist' : ''}
            onChange={(event) => {
              onTextChange(event.target.value);
              setError(undefined);
            }}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <IconFileSpreadsheet className="size-5" aria-hidden />
              Upload a spreadsheet
            </Button>
            <input ref={fileRef} type="file" accept={ROSTER_FILE_TYPES} className="hidden" onChange={handlePick} />
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base">
              <input
                type="checkbox"
                className="size-5 accent-sage"
                checked={doc.settings.firstNamesOnly}
                onChange={(event) => update((current) => setFirstNamesOnly(current, event.target.checked))}
              />
              First names only
            </label>
          </div>
        </div>
        {/* Right under the notebook (also for the keyboard); on laptops it moves below the preview. */}
        <div className="flex justify-end lg:order-3 lg:col-span-2">
          <Button onClick={handleAdd} disabled={classFull}>
            {toAdd > 0 ? `Add ${studentCount(toAdd)} →` : 'Add teammates →'}
          </Button>
        </div>
        <div className="lg:order-2">
          <NamesPreview entries={entries} plan={plan} students={doc.students} onRemove={(id) => update((current) => removeStudent(current, id))} />
        </div>
      </div>
    </div>
  );
}
