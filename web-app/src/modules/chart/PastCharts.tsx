import { IconTrash } from '@tabler/icons-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@components/Button';
import type { SavedChart } from '@modules/classroom/document';
import { count } from '@shared/text';

type Props = {
  charts: SavedChart[];
  /** The layout in the room now: only its charts can be restored. */
  layoutId: string | undefined;
  layoutName: (layoutId: string) => string;
  canSave: boolean;
  onSave: () => void;
  onRestore: (chartId: string) => void;
  onDelete: (chartId: string) => void;
};

/** Saved charts: they help Shuffle avoid repeats, and one can be put back. */
export function PastCharts({ charts, layoutId, layoutName, canSave, onSave, onRestore, onDelete }: Props) {
  // A restore or delete waits for a second "Yes": both replace or lose something.
  const [confirming, setConfirming] = useState<{ id: string; action: 'restore' | 'delete' } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const whyId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 border-t-2 border-line pt-4">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-base font-medium focus:outline-none">
        Past charts
      </h2>
      <Button variant="secondary" className="self-start" disabled={!canSave} onClick={onSave} aria-describedby={canSave ? undefined : whyId}>
        Save this chart
      </Button>
      <p id={whyId} className="text-sm text-ink-muted">
        {canSave ? 'Saved charts help Shuffle give everyone new seats and new neighbors.' : 'Seat your team first, then save the chart.'}
      </p>
      {charts.length > 0 && (
        <ul className="flex flex-col">
          {charts.map((saved) => {
            const asking = confirming?.id === saved.id ? confirming.action : null;
            return (
              <li key={saved.id} className="flex flex-col gap-1 border-b-2 border-line py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{saved.name}</span>
                    <span className="block text-ink-muted">
                      {layoutName(saved.layoutId)} · {count(Object.keys(saved.assignment).length, 'teammate')}
                    </span>
                  </span>
                  {saved.layoutId === layoutId && (
                    <button type="button" onClick={() => setConfirming({ id: saved.id, action: 'restore' })} className="min-h-11 cursor-pointer rounded-full px-3 font-semibold text-sage-ink hover:bg-sage-mist">
                      Restore
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirming({ id: saved.id, action: 'delete' })}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-hover"
                  >
                    <IconTrash className="size-4" aria-hidden />
                    <span className="sr-only">Delete {saved.name}</span>
                  </button>
                </div>
                {asking && (
                  <div role="group" aria-label={asking === 'restore' ? 'Restore this chart?' : 'Delete this chart?'} className="flex flex-wrap items-center gap-2 rounded-lg bg-sage-mist p-2">
                    <span className="flex-1">{asking === 'restore' ? 'Put everyone back in these seats?' : 'Delete this chart?'}</span>
                    <Button
                      variant={asking === 'restore' ? 'secondary' : 'danger'}
                      autoFocus
                      onClick={() => {
                        setConfirming(null);
                        if (asking === 'restore') onRestore(saved.id);
                        else onDelete(saved.id);
                        // The buttons go away: focus waits on the heading.
                        headingRef.current?.focus();
                      }}
                    >
                      {asking === 'restore' ? 'Yes, restore' : 'Yes, delete'}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
