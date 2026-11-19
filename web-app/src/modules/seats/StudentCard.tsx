import { IconCheck, IconLock, IconLockOpen, IconX } from '@tabler/icons-react';

import { Button } from '@components/Button';
import type { DocStudent } from '@modules/classroom/document';
import { NEEDS } from '@modules/classroom/levels';
import type { Level, NeedKind } from '@modules/seating/engine';
import { LevelStamp } from '@modules/students/LevelStamp';

type Props = {
  student: DocStudent;
  hidden: boolean;
  /** The seat's label, or null when the student has no seat. */
  seatLabel: Level | null;
  locked: boolean;
  /** Everyone else, to swap with. */
  others: DocStudent[];
  onLock: () => void;
  onUnseat: () => void;
  onSwap: (otherId: string) => void;
  onClose: () => void;
  /** Who sits right next to them, and which needs this seat meets. */
  details: { neighbors: { id: string; name: string; level: Level | null }[]; needs: { need: NeedKind; met: boolean | null }[] };
  /** Opens their level, needs and notes to change them. */
  onEdit: () => void;
};

/** The picked student: their level and seat, and what can be done with them. */
export function StudentCard({ student, hidden, seatLabel, locked, others, onLock, onUnseat, onSwap, onClose, details, onEdit }: Props) {
  return (
    <section aria-label={student.name} data-keep-student className="flex flex-col gap-3 rounded-2xl border-2 border-sage-line bg-sage-mist p-3">
      <div className="flex items-center gap-2">
        {!hidden && <LevelStamp level={student.level} size="sm" announce />}
        <p className="min-w-0 flex-1 truncate text-base font-semibold">{student.name}</p>
        <button type="button" onClick={onClose} className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-hover">
          <IconX className="size-5" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <p className="text-sm text-ink-muted">{seatLabel === null ? 'No seat yet' : hidden ? 'Has a seat' : `In a ${seatLabel} seat`}</p>
      {details.neighbors.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Sits next to</p>
          <ul className="flex flex-wrap gap-1.5">
            {details.neighbors.map((neighbor) => (
              <li key={neighbor.id} className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-sm">
                {!hidden && <LevelStamp level={neighbor.level} size="sm" announce />}
                {neighbor.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!hidden && details.needs.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {details.needs.map(({ need, met }) => (
            <li key={need} className={`flex items-center gap-1.5 ${met === false ? 'text-danger' : 'text-sage-ink'}`}>
              {met === false ? <IconX className="size-4" aria-hidden /> : <IconCheck className="size-4" aria-hidden />}
              {NEEDS.find((entry) => entry.kind === need)?.label}
              <span className="sr-only">{met === false ? ': not met here' : ': met'}</span>
            </li>
          ))}
        </ul>
      )}
      {seatLabel !== null && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onLock}>
            {locked ? <IconLockOpen className="size-5" aria-hidden /> : <IconLock className="size-5" aria-hidden />}
            {locked ? 'Unlock seat' : 'Lock seat'}
          </Button>
          <Button variant="secondary" onClick={onUnseat}>
            Unseat
          </Button>
          {!hidden && (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Swap seats with
        <select
          value=""
          onChange={(event) => event.target.value && onSwap(event.target.value)}
          className="min-h-11 rounded-xl border-2 border-field-border bg-card px-2 text-base"
        >
          <option value="">Pick a teammate…</option>
          {others.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
