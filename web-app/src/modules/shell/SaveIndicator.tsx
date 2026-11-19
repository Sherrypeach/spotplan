import { IconAlertTriangle, IconCircleCheck, IconLoader2 } from '@tabler/icons-react';

import { useClassroom } from '@modules/classroom/classroom';

/** A clear message and one button when saving goes wrong; nothing while it goes well. */
export function SaveProblems() {
  const { saveState, retrySave, reload } = useClassroom();

  if (saveState === 'conflict') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/10 px-4 py-2 text-base text-danger">
        <IconAlertTriangle className="size-5" aria-hidden />
        This team was changed somewhere else, so your last change wasn’t saved.
        <button type="button" onClick={reload} className="min-h-11 cursor-pointer rounded-lg px-2 font-semibold hover:bg-hover">
          Load the latest
        </button>
      </div>
    );
  }
  if (saveState === 'rejected') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/10 px-4 py-2 text-base text-danger">
        <IconAlertTriangle className="size-5" aria-hidden />
        We couldn’t save your last change.
        <button type="button" onClick={reload} className="min-h-11 cursor-pointer rounded-lg px-2 font-semibold hover:bg-hover">
          Load the team again
        </button>
      </div>
    );
  }
  if (saveState === 'error') {
    return (
      <div role="alert" className="flex items-center gap-2 text-base text-danger">
        <IconAlertTriangle className="size-5" aria-hidden />
        Not saved yet.
        <button type="button" onClick={retrySave} className="min-h-11 cursor-pointer rounded-lg px-2 font-semibold hover:bg-hover">
          Try again
        </button>
      </div>
    );
  }
  return null;
}

/** A quiet "Saving… / Saved" for the green bar; problems show below it (SaveProblems). */
export function SaveIndicator() {
  const { saveState } = useClassroom();
  if (saveState === 'conflict' || saveState === 'rejected' || saveState === 'error') {
    return (
      <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-base text-white">
        <IconAlertTriangle className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Not saved</span>
      </p>
    );
  }
  const saving = saveState === 'saving' || saveState === 'unsaved';
  return (
    // Not a live region: "Saving… Saved" after every change would chatter.
    <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-base text-white/90">
      {saving ? (
        <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <IconCircleCheck className="size-4" aria-hidden />
      )}
      <span className="sr-only sm:not-sr-only">{saving ? 'Saving…' : 'Saved'}</span>
    </p>
  );
}
