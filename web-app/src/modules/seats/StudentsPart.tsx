import { IconArrowsShuffle, IconLoader2 } from '@tabler/icons-react';

import { Button } from '@components/Button';
import type { ClassroomDocument, DocStudent } from '@modules/classroom/document';
import type { Level } from '@modules/seating/engine';
import { StudentCard } from '@modules/seats/StudentCard';
import type { ChipProps } from '@modules/students/useChipDrag';

type Props = {
  doc: ClassroomDocument;
  hidden: boolean;
  busy: boolean;
  /** "Placed 24 students. 3 things to check." after seating the class. */
  result: string;
  seated: boolean;
  seatedCount: number;
  classSize: number;
  lockedCount: number;
  unseated: DocStudent[];
  picked: DocStudent | undefined;
  pickedSeatLabel: Level | null;
  pickedLocked: boolean;
  dropOver: boolean;
  chipProps: (id: string, name: string, from: string) => ChipProps;
  onPlace: () => void;
  onShuffle: () => void;
  onUnlockAll: () => void;
  /** Shuffle's settings: balance color tags, and steer away from saved charts. */
  onSettings: (settings: { balanceColors?: boolean; usePastCharts?: boolean }) => void;
  /** Opens the students' levels, coming back here after. */
  onReviewLevels: () => void;
  onPick: (studentId: string | null) => void;
  onLock: () => void;
  onUnseat: () => void;
  onSwap: (otherId: string) => void;
  details: Parameters<typeof StudentCard>[0]['details'];
  onEdit: () => void;
};

/** Part 2: seat the class, then move, lock or unseat students. */
export function StudentsPart(props: Props) {
  const { doc, hidden, busy, result, seated, lockedCount, unseated, picked, dropOver, chipProps } = props;
  return (
    <div className="flex flex-col gap-4">
      <Button onClick={props.onPlace} disabled={busy} data-tour="place-students">
        {busy && <IconLoader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />}
        {seated ? 'Place again' : 'Place teammates'}
      </Button>
      <p className="text-sm text-ink-muted empty:hidden" role="status">
        {result}
      </p>
      {props.seated && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {props.seatedCount} of {props.classSize} seated
          </p>
          <div className="h-2 rounded-full bg-sage-soft" aria-hidden>
            <div className="h-2 rounded-full bg-sage" style={{ width: `${Math.round((props.seatedCount / Math.max(1, props.classSize)) * 100)}%` }} />
          </div>
        </div>
      )}
      {seated && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={props.onShuffle} disabled={busy}>
            <IconArrowsShuffle className="size-5" aria-hidden />
            Shuffle
          </Button>
          {lockedCount > 0 && (
            <Button variant="secondary" onClick={props.onUnlockAll}>
              Unlock all ({lockedCount})
            </Button>
          )}
          <button type="button" onClick={props.onReviewLevels} className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-sage-ink">
            Review levels first
          </button>
        </div>
      )}
      {seated && (
        <details className="rounded-xl bg-sage-mist px-3 py-2 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-sage-ink">Shuffle settings</summary>
          <div className="mt-2 flex flex-col gap-1">
            {doc.colors.enabled && (
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5 accent-sage" checked={doc.settings.balanceColors} onChange={(event) => props.onSettings({ balanceColors: event.target.checked })} />
                Mix color tags across tables
              </label>
            )}
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-5 accent-sage" checked={doc.settings.usePastCharts} onChange={(event) => props.onSettings({ usePastCharts: event.target.checked })} />
              Give new seats and new neighbors (uses saved charts)
            </label>
          </div>
        </details>
      )}
      <p className="text-sm text-ink-muted">
        Drag a name onto another to swap them. Or click a name, then an empty seat to move them there.
      </p>
      {picked && (
        <StudentCard
          student={picked}
          hidden={hidden}
          seatLabel={props.pickedSeatLabel}
          locked={props.pickedLocked}
          others={doc.students.filter((student) => student.id !== picked.id)}
          onLock={props.onLock}
          onUnseat={props.onUnseat}
          onSwap={props.onSwap}
          onClose={() => props.onPick(null)}
          details={props.details}
          onEdit={props.onEdit}
        />
      )}
      <section
        aria-label="Unseated"
        data-drop-zone="unseated"
        className={`flex min-h-16 flex-col gap-2 rounded-2xl border-2 border-dashed p-3 ${dropOver ? 'border-sage bg-sage-mist' : 'border-sage-line'}`}
      >
        <h2 className="text-sm font-semibold">Unseated ({unseated.length})</h2>
        {unseated.length === 0 ? (
          <p className="text-sm text-ink-muted">Everyone has a seat.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {unseated.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  {...chipProps(student.id, student.name, 'unseated')}
                  onClick={() => props.onPick(student.id)}
                  aria-pressed={picked?.id === student.id}
                  className={`min-h-11 cursor-grab rounded-full border-2 px-3 text-sm font-medium ${
                    picked?.id === student.id ? 'border-sage bg-sage-soft text-sage-ink' : 'border-sage-line bg-card'
                  }`}
                >
                  {student.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
