import { IconMoon, IconPlus, IconRoute, IconSun } from '@tabler/icons-react';
import { useCallback, useId, useRef, useState } from 'react';

import { useAuth, type SessionUser } from '@context/auth';
import { useClassroom } from '@modules/classroom/classroom';
import { MAX_CLASSES } from '@modules/classroom/ClassSwitcher';
import { SignOutButton } from '@modules/shell/SignOutButton';
import { useTour } from '@modules/tour/tour';
import { useDismiss } from '@shared/useDismiss';
import { useTheme } from '@shared/themeContext';

const ITEM_CLASS = 'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-base hover:bg-sage-mist';

function fullName(user: SessionUser | null): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
}

function initial(user: SessionUser | null): string {
  return (user?.firstName || user?.email || '?').charAt(0).toUpperCase();
}

type Props = {
  /** Opens the new-class form; missing when there's no class screen to switch from. */
  onNewClass?: () => void;
};

/** The teacher's initial in the bar, opening who's signed in, the tour, dark mode, a new class, and sign out. */
export function AccountMenu({ onNewClass }: Props) {
  const { user } = useAuth();
  const { classes } = useClassroom();
  const { theme, setTheme } = useTheme();
  const { start, available: tourAvailable } = useTour();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const name = fullName(user);
  const dark = theme === 'dark';

  // A click or Tab anywhere else, or Escape, closes it; Escape puts focus back on the initial.
  const close = useCallback((byEscape: boolean) => {
    setOpen(false);
    if (byEscape) buttonRef.current?.focus();
  }, []);
  useDismiss(wrapperRef, open, close);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Account, ${name || user?.email || ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((shown) => !shown)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-sage-mist text-base font-semibold text-title ring-3 ring-white/35" aria-hidden>
          {initial(user)}
        </span>
      </button>
      {open && (
        // Light panel: the usual sage focus ring again.
        <div
          id={panelId}
          className="absolute top-full right-0 z-30 mt-2 flex w-64 flex-col gap-0.5 rounded-2xl border-2 border-sage-line bg-card p-2 text-ink [&_:focus-visible]:outline-sage"
        >
          <div className="mb-1 border-b-2 border-line px-3 pt-1 pb-2">
            {name && <p className="truncate text-base font-semibold">{name}</p>}
            <p className="truncate text-sm text-ink-muted" title={user?.email}>
              {user?.email}
            </p>
          </div>
          {tourAvailable && (
            <button
              type="button"
              className={ITEM_CLASS}
              onClick={() => {
                // Closed first, so the tour's spotlight isn't covered by the menu.
                setOpen(false);
                start();
              }}
            >
              <IconRoute className="size-5" aria-hidden />
              Take the tour
            </button>
          )}
          <button type="button" aria-pressed={dark} className={ITEM_CLASS} onClick={() => setTheme(dark ? 'light' : 'dark')}>
            {dark ? <IconSun className="size-5" aria-hidden /> : <IconMoon className="size-5" aria-hidden />}
            Dark mode{dark ? ': on' : ''}
          </button>
          {onNewClass && classes.length < MAX_CLASSES && (
            <button
              type="button"
              className={ITEM_CLASS}
              onClick={() => {
                setOpen(false);
                onNewClass();
              }}
            >
              <IconPlus className="size-5" aria-hidden />
              New team
            </button>
          )}
          <div className="border-t-2 border-line pt-0.5">
            <SignOutButton className="w-full justify-start px-3 text-ink hover:bg-sage-mist" />
          </div>
        </div>
      )}
    </div>
  );
}
