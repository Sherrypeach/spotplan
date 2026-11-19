import { LEVELS } from '@modules/classroom/levels';
import { LevelStamp } from '@modules/students/LevelStamp';

/** "What do the levels mean?", folded until asked. */
export function LevelsExplained() {
  return (
    <details className="group self-start rounded-2xl border-2 border-line bg-card px-4 py-2">
      <summary className="flex min-h-9 cursor-pointer items-center text-base font-semibold text-sage-ink">
        What do the levels mean?
      </summary>
      <dl className="flex flex-col gap-3 pt-2 pb-2">
        {LEVELS.map(({ level, name, description }) => (
          <div key={level} className="flex gap-3">
            <LevelStamp level={level} size="sm" />
            <div>
              <dt className="text-base font-semibold">{name}</dt>
              <dd className="text-base text-ink-muted">{description}</dd>
            </div>
          </div>
        ))}
      </dl>
    </details>
  );
}
