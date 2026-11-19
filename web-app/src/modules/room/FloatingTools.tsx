import { IconArmchair, IconArrowsSplit, IconCheck, IconCopy, IconRotateClockwise2, IconTrash } from '@tabler/icons-react';

type Props = {
  /** What's picked up, read out when it changes ("Table · 4 seats"). */
  label: string;
  onTurn?: () => void;
  onCopy?: () => void;
  /** Breaks a table into pieces that move on their own. */
  onSplit?: () => void;
  /** What Split is called here ("Chair out" for My desk). */
  splitLabel?: string;
  /** Gives My desk its chair back. */
  onAddChair?: () => void;
  /** Puts a pulled-out chair back under My desk ("Chair in" on the desk, "Back to desk" on the chair). */
  onRejoin?: () => void;
  rejoinLabel?: string;
  onRemove: () => void;
  onDone: () => void;
  /** One short line on what to do next, under the buttons. */
  hint?: string;
};

const TOOL =
  'flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-xl px-2 text-xs font-semibold text-ink hover:bg-sage-mist';

/** The big buttons that float next to the picked-up table or spot. */
export function FloatingTools({ label, onTurn, onCopy, onSplit, splitLabel = 'Split', onAddChair, onRejoin, rejoinLabel = 'Chair in', onRemove, onDone, hint }: Props) {
  return (
    <div role="toolbar" aria-label={label} className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border-2 border-sage-line bg-card p-1 whitespace-nowrap shadow-lg">
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
      {onTurn && (
        <button type="button" className={TOOL} onClick={onTurn}>
          <IconRotateClockwise2 className="size-5" aria-hidden />
          Turn
        </button>
      )}
      {onCopy && (
        <button type="button" className={TOOL} onClick={onCopy}>
          <IconCopy className="size-5" aria-hidden />
          Copy
        </button>
      )}
      {onSplit && (
        <button type="button" className={TOOL} onClick={onSplit}>
          <IconArrowsSplit className="size-5" aria-hidden />
          {splitLabel}
        </button>
      )}
      {onRejoin && (
        <button type="button" className={TOOL} onClick={onRejoin}>
          <IconArmchair className="size-5" aria-hidden />
          {rejoinLabel}
        </button>
      )}
      {onAddChair && (
        <button type="button" className={TOOL} onClick={onAddChair}>
          <IconArmchair className="size-5" aria-hidden />
          Chair
        </button>
      )}
      <button type="button" className={`${TOOL} text-danger`} onClick={onRemove}>
        <IconTrash className="size-5" aria-hidden />
        Remove
      </button>
      <button type="button" className={`${TOOL} bg-sage-soft text-sage-ink`} onClick={onDone}>
        <IconCheck className="size-5" aria-hidden />
        Done
      </button>
      {/* Never wider than the buttons, so the toolbar keeps its size wherever it sits. */}
      {hint && <p className="w-0 min-w-full px-2 pb-1 text-center text-xs font-medium whitespace-normal text-ink-muted">{hint}</p>}
    </div>
  );
}
