import { LEVEL_STAMP } from '@modules/classroom/levels';
import type { Level, SeatLabels } from '@modules/seating/engine';

type Props = {
  labels: SeatLabels;
  levelOnes: number;
  handSet: boolean;
  onReset: () => void;
};

const LEVELS: Level[] = [1, 2, 3];

/** Part 1: how many seats of each label, and a way back to the suggestions. */
export function LabelsPart({ labels, levelOnes, handSet, onReset }: Props) {
  const count = (level: Level) => Object.values(labels).filter((label) => label === level).length;
  const spare = count(1) - levelOnes;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-semibold">These circles are seats, not teammates</p>
      <p className="text-base text-ink-muted">
        The number says who should sit there. 1s go close to where you work, never right next to each other. Click a seat to choose who it’s for.
      </p>
      <ul className="flex gap-2" aria-label="Seats of each label">
        {LEVELS.map((level) => (
          <li key={level} className={`rounded-full px-3 py-1 text-base font-semibold ${LEVEL_STAMP[level]}`}>
            {level} · {count(level)}
          </li>
        ))}
      </ul>
      {levelOnes > 0 && spare > 0 && (
        <p className="text-sm text-ink-muted">
          You have {levelOnes} level-1 {levelOnes === 1 ? 'teammate' : 'teammates'}, so there {spare === 1 ? 'is 1 spare 1 seat' : `are ${spare} spare 1 seats`}.
        </p>
      )}
      {handSet && (
        <button type="button" onClick={onReset} className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink">
          Back to suggestions
        </button>
      )}
    </div>
  );
}
