import { useId, useState } from 'react';

// Whether the teacher folded the tips away, remembered on this device for every step.
const FOLDED_KEY = 'seating.tipsFolded';

// On a phone the tips start folded, to leave the small screen for the work.
// Below Tailwind's sm breakpoint (640px).
const SMALL_SCREEN = '(max-width: 639px)';

function readFolded(): boolean {
  try {
    const saved = localStorage.getItem(FOLDED_KEY);
    if (saved !== null) return saved === '1';
  } catch {
    // Storage can be blocked; fall through to the screen size.
  }
  return window.matchMedia?.(SMALL_SCREEN).matches ?? false;
}

function saveFolded(folded: boolean): void {
  try {
    localStorage.setItem(FOLDED_KEY, folded ? '1' : '0');
  } catch {
    // Storage can be blocked; the tip just opens again next time.
  }
}

type Props = {
  tip: string;
  /** Always showing, with no Hide (the Room step). */
  fixed?: boolean;
  /** The line beside it, in the step's color. */
  accentClass?: string;
};

/**
 * "Quick help": a short note with a line in the step's color beside it.
 * "Hide" shrinks it to "Quick help", and it stays that way until "Show".
 */
export function TipBox({ tip, fixed = false, accentClass = 'border-sage-line' }: Props) {
  const [savedFolded, setFolded] = useState(readFolded);
  const folded = !fixed && savedFolded;
  const textId = useId();

  const handleToggle = () => {
    const next = !folded;
    saveFolded(next);
    setFolded(next);
  };

  return (
    <aside
      aria-label="Quick help"
      className={`inline-flex max-w-2xl items-center gap-2 self-start border-l-4 pl-3 text-base leading-snug text-ink-muted ${accentClass}`}
    >
      <p id={textId} className="py-1.5">
        {folded ? <span className="font-semibold">Quick help</span> : tip}
      </p>
      {!fixed && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={!folded}
          aria-controls={textId}
          className="min-h-10 shrink-0 cursor-pointer rounded-xl px-3 text-sm font-semibold text-sage-ink hover:bg-hover"
        >
          {folded ? 'Show' : 'Hide'}
        </button>
      )}
    </aside>
  );
}
