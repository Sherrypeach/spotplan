import { IconCheck, IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useCallback, useId, useRef, useState } from 'react';

import { useClassroom } from '@modules/classroom/classroom';
import { useDismiss } from '@shared/useDismiss';
import { MAX_CLASSES_PER_TEACHER } from '@shared/serverLimits';

export const MAX_CLASSES = MAX_CLASSES_PER_TEACHER;
const ITEM_CLASS = 'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-base hover:bg-sage-mist';

type Props = {
  onNewClass: () => void;
  /** In the green bar: no visible "Class" label, a small outline pill, and its list opening below. */
  onBrand?: boolean;
};

/**
 * Which class is open, and a way to open another or add one. A button and a
 * list rather than a dropdown, so moving through the choices never opens a class.
 */
export function ClassSwitcher({ onNewClass, onBrand = false }: Props) {
  const { classes, current, selectClass } = useClassroom();
  const labelId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A click or Tab anywhere else, or Escape, closes the list.
  const close = useCallback((byEscape: boolean) => {
    setOpen(false);
    if (byEscape) buttonRef.current?.focus();
  }, []);
  useDismiss(wrapperRef, open, close);

  if (!current) return null;

  const choose = (id: number) => {
    setOpen(false);
    buttonRef.current?.focus();
    void selectClass(id);
  };

  return (
    <div ref={wrapperRef} className={`relative flex flex-col gap-1 ${onBrand ? 'max-w-56' : ''}`}>
      <span id={labelId} className={onBrand ? 'sr-only' : 'text-sm text-ink-muted'}>
        Team
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-labelledby={`${labelId} ${listId}-current`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((shown) => !shown)}
        className={
          onBrand
            ? 'flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-full border-2 border-white/60 px-3 text-left text-sm font-semibold text-white hover:bg-white/15'
            : 'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 border-field-border bg-card py-2 pr-3 pl-3 text-left text-base font-semibold'
        }
      >
        <span id={`${listId}-current`} className="truncate">
          {current.name}
        </span>
        <IconChevronDown className={`${onBrand ? 'size-4' : 'size-5'} shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          className={`absolute top-full left-0 z-20 mt-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-xl border-2 border-sage-line bg-card p-1 text-ink [&_:focus-visible]:outline-sage ${onBrand ? 'w-64' : 'right-0'}`}
        >
          {classes.map((summary) => {
            const isOpen = summary.id === current.id;
            return (
              <li key={summary.id}>
                <button
                  type="button"
                  aria-current={isOpen || undefined}
                  onClick={() => choose(summary.id)}
                  className={`${ITEM_CLASS} ${isOpen ? 'font-semibold text-sage-ink' : ''}`}
                >
                  <span className="min-w-0 flex-1 truncate">{summary.name}</span>
                  {isOpen && <IconCheck className="size-4 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
          {classes.length < MAX_CLASSES && (
            <li className="border-t-2 border-line pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNewClass();
                }}
                className={`${ITEM_CLASS} font-medium text-sage-ink`}
              >
                <IconPlus className="size-4" aria-hidden />
                Add a team
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
