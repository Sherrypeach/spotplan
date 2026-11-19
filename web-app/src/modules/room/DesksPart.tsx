import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@components/Button';
import { Chip } from '@components/Chip';
import { Lockable } from '@components/Lockable';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocRoom } from '@modules/classroom/document';
import { layoutName } from '@modules/layouts/layoutName';
import type { Layout, LayoutCategory, LayoutLibrary } from '@modules/layouts/types';
import { offeringAll, offers, WANTS, type WantKey } from '@modules/layouts/wants';
import {
  addSeats,
  chooseLayout,
  fittedSize,
  isLayoutChanged,
  placeLayout,
  rugOf,
  scaleLayout,
  LAYOUT_SIZE_STEP,
  MAX_LAYOUT_SIZE,
  MIN_LAYOUT_SIZE,
  SMALLEST_READABLE_SIZE,
} from '@modules/room/layoutPlacement';
import { LayoutDetail, ProsCons } from '@modules/room/LayoutDetail';
import { LayoutThumb } from '@modules/room/LayoutThumb';
import { NAMES_PART_PATH } from '@modules/students/parts';
import { count } from '@shared/text';

type Props = {
  library: LayoutLibrary;
  /** How many desks poke through a wall. */
  outsideWalls: number;
  /** How many desks lie on top of another table. */
  overlapping: number;
  /** The kind of seating offered; another kind than the current layout's shows "Select an option" in the room. */
  kind: LayoutCategory;
  onKind: (kind: LayoutCategory) => void;
  /** The layout being tried on, placed in the teacher's room, with how many desks land on something. */
  preview: { layout: Layout; room: DocRoom; problems: number } | null;
  onPreview: (layoutId: string | null) => void;
};

const KINDS: { category: LayoutCategory; label: string }[] = [
  { category: 'desks', label: 'Desks' },
  { category: 'rectangle-tables', label: 'Tables' },
];

// Cards shown before "More ways".
const GOOD_FITS = 4;

/** Layouts closest to the class size first, then by name. */
function bestFits(layouts: Layout[], students: number): Layout[] {
  return [...layouts].sort(
    (a, b) => Math.abs(a.seats.length - students) - Math.abs(b.seats.length - students) || a.name.localeCompare(b.name),
  );
}

/** Part 2: what the students sit at, which layout, how big, and a seat for every child. */
export function DesksPart({ library, outsideWalls, overlapping, kind, onKind, preview, onPreview }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const current = library.layouts.find((layout) => layout.id === doc.room.layout?.id) ?? null;
  const [showAll, setShowAll] = useState(false);
  const [wanted, setWanted] = useState<WantKey[]>([]);
  const [note, setNote] = useState('');

  const students = doc.students.length;
  const seats = doc.room.seats.length;
  const onRug = rugOf(doc.room) !== null;
  const seatWord = onRug ? 'rug seat' : 'seat';
  // Rugs without seats in the library aren't offered yet.
  const ofKind = library.layouts.filter((layout) => layout.category === kind && layout.seats.length > 0);
  // A stable order, so the card under the pointer stays put on click. The current layout is always listed.
  // Only wants some layout of this kind offers; the rest stay chosen for when the kind changes back.
  const offered = WANTS.filter((want) => ofKind.some((layout) => offers(layout, want)));
  const active = offered.filter((want) => wanted.includes(want.key));
  const matching = offeringAll(ofKind, active);
  const ranked = bestFits(matching, students);
  const fits = ranked.slice(0, GOOD_FITS);
  const shown = showAll ? ranked : current && matching.includes(current) && !fits.includes(current) ? [...fits, current] : fits;
  const toggleWant = (key: WantKey) => {
    setWanted((keys) => (keys.includes(key) ? keys.filter((other) => other !== key) : [...keys, key]));
    setShowAll(false);
  };
  const size = doc.room.layout?.size ?? 1;
  const sizeId = useId();
  const [draftSize, setDraftSize] = useState<number | null>(null);
  const shownSize = draftSize ?? Math.round(size * 100);
  const commitSize = () => {
    if (draftSize === null) return;
    setDraftSize(null);
    if (draftSize !== Math.round(size * 100)) editRoom((room) => scaleLayout(room, draftSize / 100));
  };

  const editRoom = (edit: (room: DocRoom) => DocRoom) => update((currentDoc) => ({ ...currentDoc, room: edit(currentDoc.room) }));

  // Using a layout puts it in the room; with extra seats when the class needs them.
  const use = (layout: Layout, extra: number) => {
    setNote('');
    onPreview(null);
    const placed = chooseLayout(doc.room, layout, current);
    const result = extra > 0 ? addSeats(placed, extra) : { room: placed, added: 0 };
    editRoom(() => result.room);
    if (result.added < extra) setNote(rugOf(placed) ? 'The rug is full. Try a bigger rug.' : 'There’s no more open floor. Make the layout smaller.');
  };

  const filter = (category: LayoutCategory) => {
    onKind(category);
    setShowAll(false);
  };

  const add = (wanted: number) => {
    const result = addSeats(doc.room, wanted);
    if (result.added > 0) editRoom(() => result.room);
    setNote(result.added < wanted ? (onRug ? 'The rug is full. Try a bigger rug.' : 'There’s no more open floor. Make the layout smaller.') : '');
  };

  const missing = students - seats;

  if (preview) {
    return (
      <Lockable locked={doc.room.locked}>
        <LayoutDetail preview={preview} students={students} onUse={(extra) => use(preview.layout, extra)} onBack={() => onPreview(null)} />
      </Lockable>
    );
  }

  return (
    <Lockable locked={doc.room.locked} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">What do your teammates sit at?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ category, label }) => {
            const on = category === kind;
            return (
              <Chip key={category} pressed={on} onClick={() => filter(category)}>
                {label}
              </Chip>
            );
          })}
        </div>
      </fieldset>

      {offered.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-medium">I want:</legend>
          <div className="flex flex-wrap gap-2">
            {offered.map((want) => {
              const on = wanted.includes(want.key);
              return (
                <Chip key={want.key} pressed={on} onClick={() => toggleWant(want.key)}>
                  {want.label}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      )}

      <section aria-label="Layouts" className="flex flex-col gap-2" data-tour="layouts">
        <h2 className="text-base font-medium">
          {active.length > 0
            ? `${count(matching.length, 'layout')} with ${active.map((want) => want.label.toLowerCase()).join(' + ')}`
            : students > 0
              ? `Good fits for ${count(students, 'teammate')}`
              : 'Popular layouts'}
        </h2>
        {active.length > 0 && matching.length === 0 && (
          <p className="text-base text-ink-muted" role="status">
            No layout here has all of these. Take one off to see more.
          </p>
        )}
        {students === 0 && (
          <Link to={NAMES_PART_PATH} className="inline-flex min-h-11 items-center self-start text-base font-semibold text-sage-ink">
            Add your team first →
          </Link>
        )}
        <ul className="grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
          {shown.map((layout) => {
            const on = layout.id === current?.id;
            const yours = Boolean(doc.room.savedLayouts?.[layout.id]);
            return (
              <li key={layout.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => (on ? undefined : onPreview(layout.id))}
                  className={`flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-2xl border-2 p-2 text-left ${
                    on ? 'border-sage bg-sage-soft' : 'border-field-border bg-card hover:border-sage-line'
                  }`}
                >
                  <LayoutThumb layout={layout} />
                  <span className="block text-sm leading-tight font-semibold">{layoutName(layout)}</span>
                  <span className="block text-sm text-ink-muted">
                    {count(layout.seats.length, 'seat')}
                    {students > 0 && layout.seats.length === students && ' · just right'}
                  </span>
                  {yours && !on && <span className="block text-xs font-medium text-sage-ink">Your changes are saved</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {matching.length > GOOD_FITS && (
          <button type="button" onClick={() => setShowAll((all) => !all)} className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink">
            {showAll ? 'Fewer' : `More ways (${matching.length - GOOD_FITS})`}
          </button>
        )}
      </section>

      {current && current.category === kind && (current.pros.length > 0 || current.cons.length > 0) && (
        <details className="rounded-2xl border-2 border-line bg-card px-4 py-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-sage-ink">Pros and cons of {layoutName(current)}</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <ProsCons title="Pros" items={current.pros} mark="+" tone="text-sage-ink" />
            <ProsCons title="Cons" items={current.cons} mark="–" tone="text-ink-muted" />
          </div>
        </details>
      )}

      {current && current.category === kind && (
        <>
          <section aria-label="Seats" className="flex flex-col gap-2 border-t-2 border-line pt-4">
            {missing > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="rounded-full bg-action-soft px-3 py-1 text-base font-medium text-action-on" aria-live="polite">
                  {count(seats, seatWord)} · your team has {students} · {missing} short
                </p>
                <Button variant="secondary" onClick={() => add(missing)}>
                  Add {count(missing, seatWord)}
                </Button>
              </div>
            ) : (
              <p className="self-start rounded-full bg-sage-soft px-3 py-1 text-base font-medium text-sage-ink" aria-live="polite">
                {students > 0 ? `${count(seats, seatWord)} for ${count(students, 'teammate')} ✓` : count(seats, seatWord)}
              </p>
            )}
            {note && <p className="text-sm text-ink-muted">{note}</p>}
          </section>

          <div className="flex flex-col gap-2">
            <label htmlFor={sizeId} className="flex items-baseline justify-between text-base font-medium">
              Layout size
              <span className="text-sm text-ink-muted">{shownSize}% of real size</span>
            </label>
            <input
              id={sizeId}
              type="range"
              min={Math.round(MIN_LAYOUT_SIZE * 100)}
              max={Math.round(MAX_LAYOUT_SIZE * 100)}
              step={Math.round(LAYOUT_SIZE_STEP * 100)}
              value={shownSize}
              aria-valuetext={`${shownSize}% of real size`}
              // The label follows the thumb; the desks change once, when it's let go, so Undo takes it back in one step.
              onChange={(event) => setDraftSize(Number(event.target.value))}
              onPointerUp={commitSize}
              onKeyUp={commitSize}
              onBlur={commitSize}
              className="min-h-11 w-full cursor-pointer accent-sage"
            />
            <p className="text-sm text-ink-muted">Make the layout smaller to fit the room, or bigger to fill it.</p>
            {size < SMALLEST_READABLE_SIZE - 0.001 && <p className="text-sm text-ink-muted">This small, names on the chart will be hard to read.</p>}
          </div>

          {isLayoutChanged(doc.room, current) && (
            <button
              type="button"
              onClick={() => editRoom((room) => placeLayout(room, current, fittedSize(room, current)))}
              className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink"
            >
              Start this layout over
            </button>
          )}

          {overlapping > 0 && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-base text-danger" role="status">
              Some desks are on top of each other or your furniture. Drag them apart.
            </p>
          )}
          {outsideWalls > 0 && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-base text-danger" role="status">
              {outsideWalls === 1 ? 'A desk goes through a wall. Drag it back inside.' : `${outsideWalls} desks go through a wall. Drag them back inside.`}
            </p>
          )}
        </>
      )}
    </Lockable>
  );
}

