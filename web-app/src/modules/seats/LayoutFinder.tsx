import { IconSearch } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import { PAINT_DELAY_MS } from '@shared/paint';

import { Button } from '@components/Button';
import type { ClassroomDocument } from '@modules/classroom/document';
import { layoutName } from '@modules/layouts/layoutName';
import type { Layout, LayoutLibrary } from '@modules/layouts/types';
import { count } from '@shared/text';
import { compareLayouts, frontFacingLayouts, type LayoutComparison, type LayoutFit } from '@modules/seats/betterLayouts';

type Props = {
  library: LayoutLibrary | null;
  /** The layouts couldn't be loaded. */
  failed: boolean;
  doc: ClassroomDocument;
  busy: boolean;
  onTry: (layout: Layout, current: Layout | null) => void;
  /** Asked from elsewhere (the Check list): search for this kind of layout. */
  request?: { kind: FindKind } | null;
  /** The request was taken; clears it so it doesn't run again. */
  onRequestHandled: () => void;
};

export type FindKind = 'better' | 'front';

const FIND: Record<FindKind, { run: (doc: ClassroomDocument, layouts: Layout[]) => LayoutComparison; title: string; none: string }> = {
  better: { run: compareLayouts, title: 'Layouts that fit your team better', none: 'No other layout fits your team clearly better in this room.' },
  front: { run: frontFacingLayouts, title: 'Layouts where every seat faces the front', none: 'No layout with every seat facing the front fits your whole team in this room.' },
};

function summary(fit: LayoutFit): string {
  const front = fit.facingFront === fit.seats && fit.seats > 0 ? 'every seat faces the front' : `${fit.facingFront} ${fit.facingFront === 1 ? 'faces' : 'face'} the front`;
  return `${count(fit.seats, 'seat')} · ${front} · ${fit.closeToYou} close to you${fit.shrunk ? ' · shrunk to fit' : ''}`;
}

// A result only describes the room and class it was found for.
function resultKey(doc: ClassroomDocument): string {
  return `${doc.room.layout?.id ?? ''}|${doc.room.seats.length}|${doc.students.length}`;
}

/** Finds layouts that fit the class better, or (asked from the Check list) ones where every seat faces the front, with what's better and worse. */
export function LayoutFinder({ library, failed, doc, busy, onTry, request, onRequestHandled }: Props) {
  const [found, setFound] = useState<{ key: string; kind: FindKind; result: LayoutComparison } | null>(null);
  const [finding, setFinding] = useState(false);
  const findButton = useRef<HTMLButtonElement>(null);
  const current = library?.layouts.find((layout) => layout.id === doc.room.layout?.id) ?? null;
  const result = found?.key === resultKey(doc) ? found.result : null;

  const find = (kind: FindKind) => {
    if (!library) return;
    setFinding(true);
    window.setTimeout(() => {
      setFound({ key: resultKey(doc), kind, result: FIND[kind].run(doc, library.layouts) });
      setFinding(false);
    }, PAINT_DELAY_MS);
  };

  // A search asked for from the Check list runs here once the layouts are in, then is done with.
  useEffect(() => {
    if (!request || !library) return;
    onRequestHandled();
    find(request.kind);
  });

  // The results come into view when they appear.
  const results = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (found) results.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [found]);

  return (
    <section aria-label="Find layouts" className="flex flex-col gap-2 border-t-2 border-line pt-4">
      <Button ref={findButton} variant="secondary" className="self-start" onClick={() => find('better')} disabled={!library} loading={finding || busy}>
        {!(finding || busy) && <IconSearch className="size-5" aria-hidden />}
        Find layouts that fit my team better
      </Button>
      {failed && <p className="text-sm text-danger">We couldn’t load the layouts. Reload the page to try again.</p>}
      <div ref={results} className="flex flex-col gap-2 empty:hidden" role="status">
        {result && found && (
          <>
            <p className="text-base font-medium">{FIND[found.kind].title}</p>
            {result.now && (
              <p className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">Now: {layoutName(result.now.layout)}</span> · {summary(result.now)}
              </p>
            )}
            {result.better.length === 0 ? (
              <p className="text-sm">{FIND[found.kind].none}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {result.better.map(({ fit, better, worse }) => (
                  <li key={fit.layout.id} className="flex flex-col gap-1 rounded-xl border-2 border-line p-2 text-sm">
                    <span className="font-semibold">{layoutName(fit.layout)}</span>
                    <span className="text-ink-muted">{summary(fit)}</span>
                    {better.length > 0 && <span className="text-sage-ink">Better: {better.join(', ')}</span>}
                    {worse.length > 0 && <span className="text-ink-muted">Worse: {worse.join(', ')}</span>}
                    <Button
                      variant="secondary"
                      className="self-start"
                      onClick={() => {
                        onTry(fit.layout, current);
                        setFound(null);
                        findButton.current?.focus();
                      }}
                    >
                      Try it
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-muted">These are guesses from your drawing. Try it seats everyone again, locked seats too. Undo puts your layout back.</p>
          </>
        )}
      </div>
    </section>
  );
}
