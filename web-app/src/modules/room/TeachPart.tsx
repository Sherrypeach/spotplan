import { Chip } from '@components/Chip';
import { IconX } from '@tabler/icons-react';

import type { DocPiece, DocSpot } from '@modules/classroom/document';
import { furnitureKindsList, furnitureName } from '@modules/room/furniture';
import { SPOT_TIMES, type SpotTime } from '@modules/room/teacherSpots';

type Props = {
  spots: DocSpot[];
  /** The room's pieces, to name the spots that sit on furniture. */
  pieces: DocPiece[];
  selected: string | null;
  onSelect: (id: string) => void;
  onTime: (id: string, time: SpotTime) => void;
  onRemove: (id: string) => void;
  /** Goes to Shape, where furniture is added. */
  onAddFurniture: () => void;
};

/** Where the teacher spends time, and how much: it decides which seats are close to the teacher. */
export function TeachPart({ spots, pieces, selected, onSelect, onTime, onRemove, onAddFurniture }: Props) {
  const free = spots.filter((spot) => !spot.pieceId);
  const nameOf = (spot: DocSpot) => {
    const piece = spot.pieceId ? pieces.find((candidate) => candidate.id === spot.pieceId) : undefined;
    if (piece) return furnitureName({ pieces }, piece);
    const index = free.indexOf(spot);
    return index === 0 ? 'Where I work' : `Where I work ${index + 1}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <blockquote className="rounded-xl bg-sage-mist px-3 py-2 text-base font-medium text-sage-ink">
        “The biggest deterrent to off-task behavior is how close you are to the teammate.”
      </blockquote>
      <p className="text-base text-ink-muted">
        Drag the green marker to where you work, and pick how much time you spend at each place. People in the green ring stay on task; in the yellow, only while you face them.
      </p>
      <ul className="flex flex-col gap-3">
        {spots.map((spot) => {
          const name = nameOf(spot);
          return (
            <li key={spot.id} className={`flex flex-col gap-2 rounded-xl border-2 p-2 ${selected === spot.id ? 'border-sage bg-sage-mist' : 'border-line'}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onSelect(spot.id)} className="flex min-h-9 flex-1 cursor-pointer items-center gap-2 text-left text-base font-semibold">
                  {name}
                </button>
                {!spot.pieceId && free.length > 1 && (
                  <button type="button" onClick={() => onRemove(spot.id)} className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-hover">
                    <IconX className="size-4" aria-hidden />
                    <span className="sr-only">Remove {name}</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`How much time at ${name}`}>
                {SPOT_TIMES.map(({ time, label }) => (
                  <Chip key={time} pressed={spot.time === time} onClick={() => onTime(spot.id, time)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-muted">
        Spend time at {furnitureKindsList()}?{' '}
        <button type="button" onClick={onAddFurniture} className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-sage-ink">
          Add it in Shape
        </button>{' '}
        and it shows up here.
      </p>
    </div>
  );
}
