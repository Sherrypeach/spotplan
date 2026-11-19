import { IconArrowLeft, IconFileTypePdf, IconPhotoDown, IconPresentation, IconPrinter } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@components/Button';
import { Chip } from '@components/Chip';
import { preloadChartFonts, printSheet, saveImage, savePdf } from '@modules/chart/chartExport';
import { deleteChart, directionsOf, MAX_TITLE, restoreChart, saveChart, setChart, sheetSeats, sheetTables } from '@modules/chart/chartModel';
import { ChartPresenter } from '@modules/chart/ChartPresenter';
import { ChartSheet } from '@modules/chart/ChartSheet';
import { CHART_PALETTES, CHART_STYLES } from '@modules/chart/chartStyles';
import { DirectionsEditor } from '@modules/chart/DirectionsEditor';
import { PastCharts } from '@modules/chart/PastCharts';
import { isTurned, layoutSheet } from '@modules/chart/sheetLayout';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocChart } from '@modules/classroom/document';
import { isStopped } from '@modules/classroom/useAutosave';
import { layoutName } from '@modules/layouts/layoutName';
import { isFurniture } from '@modules/room/furniture';
import { useLayoutLibrary } from '@modules/room/useLayoutLibrary';
import { SEAT_STUDENTS_PART_PATH } from '@modules/seats/parts';
import { currentAssignment } from '@modules/seats/seatingModel';
import { StepHeader } from '@modules/steps/StepHeader';
import { previousStep, STEPS } from '@modules/steps/steps';
import { count } from '@shared/text';

const STEP = STEPS[3];

// What the chart is for: each sets the directions and the list in one tap, leaving the room as it is.
const PRESETS: { label: string; settings: Pick<DocChart, 'showDirections' | 'showList'> }[] = [
  { label: 'Moving day', settings: { showDirections: true, showList: false } },
  { label: 'New hire copy', settings: { showDirections: false, showList: true } },
  { label: 'Door copy', settings: { showDirections: false, showList: false } },
];

// A list by table helps only with a few tables of a few students each.
const LIST_MIN_TABLES = 2;
const LIST_MAX_AT_TABLE = 8;

const FIELD = 'min-h-11 rounded-xl border-2 border-field-border bg-card px-3 text-base focus:border-sage';

/** Step 4: the clean chart, names only, to present, save as an image or print. */
export function ChartStep() {
  const doc = useClassDoc();
  const { update, saveState } = useClassroom();
  // Once saving has stopped, changes aren't kept, so nothing says they were.
  const stopped = isStopped(saveState);
  const navigate = useNavigate();
  const { library } = useLayoutLibrary();
  const titleId = useId();
  const subtitleId = useId();
  const seatListId = useId();
  const sheetRef = useRef<SVGSVGElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const presentRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const [editingDirections, setEditingDirections] = useState(false);
  const [saving, setSaving] = useState<'image' | 'pdf' | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [status, setStatus] = useState('');
  const previous = previousStep(STEP);

  // The picture and print need the fonts inside them; fetching them now saves a wait on the first click.
  useEffect(() => preloadChartFonts(), []);

  const { chart } = doc;
  const seats = sheetSeats(doc);
  const tables = sheetTables(doc);
  const unseated = doc.students.length - seats.length;
  const layoutId = doc.room.layout?.id;
  const has = (test: (kind: string) => boolean) => doc.room.pieces.some((piece) => test(piece.kind));
  const hasFurniture = doc.room.pieces.some((piece) => isFurniture(piece) && piece.kind !== 'rug');
  const listHelps = tables.length >= LIST_MIN_TABLES && Math.max(...tables.map((table) => table.seats.length)) <= LIST_MAX_AT_TABLE;
  // The list shows only where it helps, whatever was chosen before the tables changed.
  const shown = listHelps || !chart.showList ? doc : { ...doc, chart: { ...chart, showList: false } };
  const layout = seats.length > 0 ? layoutSheet(shown) : null;
  const set = (patch: Partial<DocChart>) => update((current) => setChart(current, patch));
  const nameOfLayout = (id: string) => {
    const found = library?.layouts.find((candidate) => candidate.id === id);
    return found ? layoutName(found) : 'Another layout';
  };

  const onSave = async (kind: 'image' | 'pdf') => {
    if (!sheetRef.current) return;
    setSaving(kind);
    setStatus('');
    try {
      await (kind === 'image' ? saveImage : savePdf)(sheetRef.current);
      setStatus(kind === 'image' ? 'Image saved.' : 'PDF saved.');
    } catch {
      setStatus(`We couldn’t save the ${kind === 'image' ? 'image' : 'PDF'}. Try Print instead.`);
    } finally {
      setSaving(null);
    }
  };

  const onPrint = () => {
    if (sheetRef.current) void printSheet(sheetRef.current, () => printRef.current?.focus());
  };

  const stopPresenting = () => {
    setPresenting(false);
    requestAnimationFrame(() => presentRef.current?.focus());
  };

  const onSaveChart = () => {
    if (stopped) return;
    const isNew = saveChart(doc) !== doc;
    update((current) => saveChart(current));
    setStatus(isNew ? 'Chart saved.' : 'This chart is already saved.');
  };

  const closeDirections = () => {
    setEditingDirections(false);
    requestAnimationFrame(() => editRef.current?.focus());
  };

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-5 print:max-w-none">
      <div className="print:hidden">
        <StepHeader step={STEP} title="Your seating chart" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] print:block">
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-card p-4 lg:sticky lg:top-4 print:border-0 print:p-0">
          {seats.length === 0 ? (
            <div className="flex flex-col items-start gap-2 py-6">
              <p className="text-lg">Nobody has a seat yet, so there’s no chart to show.</p>
              <Link to={SEAT_STUDENTS_PART_PATH} className="inline-flex min-h-11 items-center text-base font-semibold text-sage-ink">
                Seat your team first →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end print:hidden" data-tour="chart-actions">
                {/* Printing is what most teachers came for: the one main button. */}
                <Button ref={printRef} onClick={onPrint} className="col-span-2 sm:order-last">
                  <IconPrinter className="size-5" aria-hidden />
                  Print
                </Button>
                <Button ref={presentRef} variant="quiet" onClick={() => setPresenting(true)}>
                  <IconPresentation className="size-5" aria-hidden />
                  Present
                </Button>
                <Button variant="quiet" onClick={() => void onSave('image')} loading={saving === 'image'}>
                  <IconPhotoDown className="size-5" aria-hidden />
                  Save as image
                </Button>
                <Button variant="quiet" onClick={() => void onSave('pdf')} loading={saving === 'pdf'}>
                  <IconFileTypePdf className="size-5" aria-hidden />
                  Save as PDF
                </Button>
              </div>
              <p className="text-sm font-medium text-sage-ink print:hidden" role="status">
                {status}
              </p>
              {unseated > 0 && (
                <p className="rounded-xl bg-sage-mist px-3 py-2 text-base print:hidden">
                  {count(unseated, 'teammate')} {unseated === 1 ? 'doesn’t' : 'don’t'} have a seat yet, so {unseated === 1 ? 'isn’t' : 'aren’t'} on this chart.{' '}
                  <Link to={SEAT_STUDENTS_PART_PATH} className="font-semibold text-sage-ink">
                    Seat them →
                  </Link>
                </p>
              )}
              <div className="overflow-hidden rounded-xl border-2 border-line print:border-0">
                <ChartSheet doc={shown} ref={sheetRef} describedBy={seatListId} layout={layout ?? undefined} />
              </div>
              <div id={seatListId} className="sr-only">
                {tables.map((table) => (
                  <p key={table.number}>
                    Table {table.number}: {table.seats.map((seat) => seat.name).join(', ')}.
                  </p>
                ))}
              </div>
              <div className="flex flex-col gap-1 text-sm text-ink-muted print:hidden">
                {isTurned(doc) && <p>The chart is turned so the screen is at the top, the way the team sees the room.</p>}
                <p>Only names show. Levels, needs and notes stay private.</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border-2 border-line bg-card p-4 print:hidden">
          {seats.length > 0 && (
            <>
              <Choices legend="I’m making">
                <div className="flex flex-wrap gap-2">
                  {/* Without a useful list, a sub folder copy is the same as the door copy. */}
                  {PRESETS.filter(({ settings }) => listHelps || !settings.showList).map(({ label, settings }) => {
                    const pressed = chart.showDirections === settings.showDirections && (chart.showList && listHelps) === settings.showList;
                    return (
                      <Chip key={label} pressed={pressed} onClick={() => set(settings)}>
                        {label}
                      </Chip>
                    );
                  })}
                </div>
              </Choices>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={titleId} className="text-base font-medium">
                  Title
                </label>
                <input id={titleId} className={FIELD} maxLength={MAX_TITLE} value={chart.title} onChange={(event) => set({ title: event.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={subtitleId} className="text-base font-medium">
                  Subtitle
                </label>
                <input id={subtitleId} className={FIELD} maxLength={MAX_TITLE} placeholder="3rd floor · October" value={chart.subtitle} onChange={(event) => set({ subtitle: event.target.value })} />
              </div>


              {listHelps && (
                <Choices legend="Names">
                  <div className="flex flex-wrap gap-2">
                    <Chip pressed={!chart.showList} onClick={() => set({ showList: false })}>
                      On the desks
                    </Chip>
                    <Chip pressed={chart.showList} onClick={() => set({ showList: true })}>
                      Also a list
                    </Chip>
                  </div>
                </Choices>
              )}

              <Choices legend="On the map">
                <div className="grid grid-cols-2 gap-x-2">
                  {has((kind) => kind === 'door') && <ShowBox label="Doors" checked={chart.showDoors} onChange={(on) => set({ showDoors: on })} />}
                  {has((kind) => kind === 'window') && <ShowBox label="Windows" checked={chart.showWindows} onChange={(on) => set({ showWindows: on })} />}
                  {hasFurniture && <ShowBox label="Furniture" checked={chart.showFurniture} onChange={(on) => set({ showFurniture: on })} />}
                  {has((kind) => kind === 'rug') && <ShowBox label="Rug" checked={chart.showRug} onChange={(on) => set({ showRug: on })} />}
                  {doc.colors.enabled && <ShowBox label="Color tags" checked={chart.showColors} onChange={(on) => set({ showColors: on })} />}
                </div>
              </Choices>

              <Choices legend="Look">
                <div className="flex flex-wrap gap-2">
                  {CHART_STYLES.map(({ style, label }) => (
                    <Chip key={style} pressed={chart.style === style} onClick={() => set({ style })}>
                      <span
                        className="size-4 shrink-0 rounded-full border-2"
                        style={{ background: CHART_PALETTES[style].PAPER, borderColor: CHART_PALETTES[style].DESK_EDGE }}
                        aria-hidden
                      />
                      {label}
                    </Chip>
                  ))}
                </div>
              </Choices>

              <section aria-labelledby={`${titleId}-moving`} className="flex flex-col gap-2">
                <h3 id={`${titleId}-moving`} className="text-base font-medium">
                  Moving-day directions
                </h3>
                <ShowBox label="Show them on the chart" checked={chart.showDirections} onChange={(on) => set({ showDirections: on })} />
                {chart.showDirections &&
                  (editingDirections ? (
                    <DirectionsEditor steps={directionsOf(chart)} onChange={(steps) => set({ directions: steps })} onDone={closeDirections} />
                  ) : (
                    <button
                      ref={editRef}
                      type="button"
                      onClick={() => setEditingDirections(true)}
                      className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink"
                    >
                      Edit the directions
                    </button>
                  ))}
              </section>

              <PastCharts
                charts={doc.savedCharts}
                layoutId={layoutId}
                layoutName={nameOfLayout}
                canSave={Boolean(layoutId) && Object.keys(currentAssignment(doc)).length > 0}
                onSave={onSaveChart}
                onRestore={(id) => {
                  if (stopped) return;
                  const restored = restoreChart(doc, id);
                  if (restored === doc) {
                    setStatus('None of the teammates on that chart have a seat in this room now, so nothing changed.');
                    return;
                  }
                  update((current) => restoreChart(current, id));
                  setStatus('Chart restored.');
                }}
                onDelete={(id) => {
                  if (stopped) return;
                  update((current) => deleteChart(current, id));
                  setStatus('Chart deleted.');
                }}
              />
            </>
          )}

          {previous && (
            <div className={seats.length > 0 ? 'border-t-2 border-line pt-4' : ''}>
              <Button variant="secondary" onClick={() => navigate(SEAT_STUDENTS_PART_PATH)}>
                <IconArrowLeft className="size-5" aria-hidden />
                {previous.label}
              </Button>
            </div>
          )}
        </div>
      </div>
      {presenting && <ChartPresenter doc={shown} onClose={stopPresenting} />}
    </section>
  );
}

/** A group of choices in the panel, under its heading. */
function Choices({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-base font-medium">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** One checkbox that stays its size next to a long label. */
function ShowBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-base">
      <input type="checkbox" className="size-5 shrink-0 accent-sage" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
