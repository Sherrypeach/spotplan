import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@components/Button';
import { FormError } from '@components/FormError';
import { TextField } from '@components/TextField';
import { useClassroom } from '@modules/classroom/classroom';
import { EXAMPLE_CLASS_NAME, EXAMPLE_LAYOUT_ID, exampleClass } from '@modules/classroom/exampleClass';
import { loadLayoutLibrary } from '@modules/layouts/library';
import { STEPS } from '@modules/steps/steps';
import { refusalMessage } from '@shared/apiErrors';
import { useDocumentTitle } from '@shared/useDocumentTitle';
import { MAX_CLASS_NAME } from '@shared/serverLimits';

type Props = {
  /** The first class gets a warm welcome; later ones a plain title. */
  first: boolean;
  onCancel?: () => void;
  onCreated?: () => void;
};

/** Names a new class. It's the only thing asked before step 1. */
// The API says plainly why it refused (e.g. the class limit); anything else is likely the connection.
function createError(failure: unknown, otherwise: string): string {
  return refusalMessage(failure) ?? otherwise;
}

export function CreateClassScreen({ first, onCancel, onCreated }: Props) {
  const { createClass, update } = useClassroom();
  const navigate = useNavigate();
  useDocumentTitle('Name your team');

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setNameError(trimmed ? undefined : 'Give your team a name.');
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Declined (to keep unsaved changes): the form stays, with the name typed.
      if (await createClass(trimmed)) onCreated?.();
      else setSaving(false);
    } catch (failure) {
      setError(createError(failure, 'We couldn’t create the team. Check your connection and try again.'));
      setSaving(false);
    }
  };

  // A finished class to look around in: the example team.
  const tryExample = async () => {
    setError(null);
    setSaving(true);
    try {
      const library = await loadLayoutLibrary();
      const layout = library.layouts.find((candidate) => candidate.id === EXAMPLE_LAYOUT_ID);
      if (!layout || !(await createClass(EXAMPLE_CLASS_NAME))) {
        setSaving(false);
        return;
      }
      if (update((current) => exampleClass(current, layout))) {
        onCreated?.();
        navigate(STEPS[0].path);
      } else {
        setError(`We made “${EXAMPLE_CLASS_NAME}” but couldn’t open it to fill it in. Check your connection, then try again.`);
        setSaving(false);
      }
    } catch (failure) {
      setError(createError(failure, 'We couldn’t create the example team. Check your connection and try again.'));
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-lg flex-col gap-5 rounded-3xl border-2 border-line bg-card p-6 sm:p-8">
      <header className="text-center">
        <h1 className="text-3xl font-semibold text-title">{first ? 'Which team is this?' : 'Add a team'}</h1>
        <p className="mt-2 text-lg text-ink-muted">What do you call this team?</p>
      </header>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <TextField
          ref={nameRef}
          label="Team name"
          placeholder="For example: Marketing team, 3rd floor"
          autoComplete="off"
          maxLength={MAX_CLASS_NAME}
          autoFocus
          error={nameError}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" loading={saving}>
          {first ? 'Start →' : 'Add team'}
        </Button>
        <button type="button" onClick={tryExample} disabled={saving} className="inline-flex min-h-11 cursor-pointer items-center self-center text-base font-semibold text-sage-ink disabled:cursor-wait">
          Or try an example team first
        </button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </form>
    </section>
  );
}
