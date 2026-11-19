import { LEVEL_STAMP, LEVELS } from '@modules/classroom/levels';
import type { Level } from '@modules/seating/engine';

type Props = {
  current: Level;
  onPick: (level: Level) => void;
};

/** The three seat labels to choose from, floating next to the picked seat. */
export function LabelPicker({ current, onPick }: Props) {
  return (
    <div role="group" aria-label="Who is this seat for?" className="flex flex-col gap-1 rounded-2xl border-2 border-sage-line bg-card p-1.5 shadow-lg">
      <p className="px-1.5 pt-0.5 text-xs font-semibold text-ink-muted">This seat is for a…</p>
      {LEVELS.map(({ level, name }) => (
        <button
          key={level}
          type="button"
          aria-pressed={level === current}
          onClick={() => onPick(level)}
          className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-left text-sm font-medium whitespace-nowrap hover:bg-sage-mist ${level === current ? 'bg-sage-mist' : ''}`}
        >
          <span className={`inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold ${LEVEL_STAMP[level]}`}>{level}</span>
          {name}
        </button>
      ))}
    </div>
  );
}
