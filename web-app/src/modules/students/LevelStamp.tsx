import { LEVEL_STAMP, levelName } from '@modules/classroom/levels';
import type { Level } from '@modules/seating/engine/types';

type Props = {
  level: Level | null;
  size?: 'sm' | 'md';
  /** Say the level to screen readers, where it isn't said nearby already. */
  announce?: boolean;
};

const SIZES = { sm: 'size-6 text-sm', md: 'size-9 text-lg' };

/** The soft red 1, yellow 2 or green 3 circle; a dashed "?" before a level is set. */
export function LevelStamp({ level, size = 'md', announce = false }: Props) {
  const look = level ? LEVEL_STAMP[level] : 'border-2 border-dashed border-field-border text-ink-muted';
  const spoken = level ? `Level ${level}, ${levelName(level)}` : 'No level yet';
  return (
    <>
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${look}`} aria-hidden>
        {level ?? '?'}
      </span>
      {announce && <span className="sr-only">{spoken}, </span>}
    </>
  );
}
