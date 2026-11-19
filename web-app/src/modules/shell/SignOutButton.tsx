import { IconLogout } from '@tabler/icons-react';
import { useContext, useState } from 'react';

import { useAuth } from '@context/auth';
import { ClassroomContext } from '@modules/classroom/classroom';

type Props = {
  /** Text color, to sit on white or on green. */
  className?: string;
  /** E.g. "sr-only lg:not-sr-only" to show only the icon on narrow layouts. */
  labelClassName?: string;
};

const FAILED = 'We couldn’t sign you out. Check your connection and try again.';
const UNSAVED_QUESTION = 'Some of your changes haven’t been saved yet. Sign out anyway and lose them?';

export function SignOutButton({ className = 'text-ink-muted hover:text-sage-ink', labelClassName = '' }: Props) {
  const { logout } = useAuth();
  // Outside a class (e.g. before one is made) there's nothing to save.
  const classroom = useContext(ClassroomContext);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (signingOut) return;
    setError(null);
    setSigningOut(true);
    const saved = classroom ? await classroom.saveNow() : true;
    if (!saved && !window.confirm(UNSAVED_QUESTION)) {
      setSigningOut(false);
      return;
    }
    try {
      await logout();
    } catch {
      setError(FAILED);
      setSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-disabled={signingOut || undefined}
        className={`flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-base font-medium whitespace-nowrap ${className}`}
      >
        <IconLogout className="size-5" aria-hidden />
        <span className={`whitespace-nowrap ${labelClassName}`}>Sign out</span>
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-64 rounded-lg bg-card px-2 py-1 text-base text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
