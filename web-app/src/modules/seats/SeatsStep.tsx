import { IconArrowBackUp, IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@components/Button';
import { PartProgress } from '@components/PartProgress';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { ClassroomDocument } from '@modules/classroom/document';
import { DESKS_PART_PATH } from '@modules/room/parts';
import { RoomDrawing } from '@modules/room/RoomDrawing';
import { deskUnit } from '@modules/room/roomGroups';
import { useLayoutLibrary } from '@modules/room/useLayoutLibrary';
import { useRoomHistory } from '@modules/room/useRoomHistory';
import { suggestSwaps, type CheckItem, type Level, type Room, type SwapSuggestion } from '@modules/seating/engine';
import { switchLayout } from '@modules/seats/betterLayouts';
import { CheckPart } from '@modules/seats/CheckPart';
import { LayoutFinder, type FindKind } from '@modules/seats/LayoutFinder';
import { checkSentence } from '@modules/seats/checkText';
import { LabelPicker } from '@modules/seats/LabelPicker';
import { LabelsPart } from '@modules/seats/LabelsPart';
import { isSeatPartKey, SEAT_PARTS, type SeatPartKey } from '@modules/seats/parts';
import { SeatLayer } from '@modules/seats/SeatLayer';
import { namePlaces, shownNames } from '@modules/seats/seatNames';
import {
  checkInput,
  checks,
  currentAssignment,
  engineRoom,
  feedbackOf,
  labelOf,
  lockedAssignment,
  fixAll,
  moveStudent,
  nudgeFeedback,
  placeAll,
  resetLabels,
  seatLabels,
  setLabel,
  shuffleAll,
  studentDetails,
  applySuggestion,
  toggleCheckedOff,
  toggleLock,
  unlockAll,
  unseat,
} from '@modules/seats/seatingModel';
import { StudentsPart } from '@modules/seats/StudentsPart';
import { usePrivacy } from '@modules/shell/privacy';
import { StepHeader } from '@modules/steps/StepHeader';
import { nextStep, previousStep, STEPS } from '@modules/steps/steps';
import { CHECK_PART_PATH, NAMES_PART_PATH } from '@modules/students/parts';
import { PrivateCover } from '@modules/students/PrivateCover';
import { StudentPanel } from '@modules/students/StudentPanel';
import { dragHintFor, fixedMessage, placedMessage } from '@modules/seats/seatsMessages';
import { useChipDrag } from '@modules/students/useChipDrag';
import { useOutsideTap } from '@shared/useOutsideTap';
import { PAINT_DELAY_MS } from '@shared/paint';

const STEP = STEPS[2];

const TITLES: Record<SeatPartKey, string> = {
  labels: 'Mark seats 1, 2 and 3',
  students: 'Seat everyone',
  check: 'Anything to fix?',
};

// The room is in it too: labels change here, and "Try it" can switch the layout.
type Undoable = Pick<ClassroomDocument, 'seating' | 'room'> & { feedback: Record<string, number> };

/** Step 3: label the seats, seat the class, then check and adjust. */
export function SeatsStep() {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const { hidden } = usePrivacy();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requested = params.get('part');
  const part: SeatPartKey = isSeatPartKey(requested) ? requested : 'labels';
  const index = SEAT_PARTS.findIndex((candidate) => candidate.key === part);
  const before = SEAT_PARTS[index - 1];
  const after = SEAT_PARTS[index + 1];
  const previous = previousStep(STEP);
  const next = nextStep(STEP);

  const [picked, setPicked] = useState<string | null>(null);
  const [pickedSeat, setPickedSeat] = useState<string | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { library, failed: libraryFailed } = useLayoutLibrary();
  const [editing, setEditing] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  // How many items were open when "Fix what I can" ran.
  const [openBeforeFix, setOpenBeforeFix] = useState<number | null>(null);
  const [layoutRequest, setLayoutRequest] = useState<{ kind: FindKind } | null>(null);

  const { seats, pieces, spots, layout, width, depth, front } = doc.room;
  const room: Room = useMemo(() => engineRoom({ seats, pieces, spots, layout, width, depth, front }), [seats, pieces, spots, layout, width, depth, front]);
  const labels = useMemo(() => seatLabels(doc, room), [doc, room]);
  const assignment = currentAssignment(doc);
  const items = useMemo(() => checks(doc, room), [doc, room]);
  const checkedOff = new Set(doc.seating.checkedOff);
  const lockedSeats = new Set(doc.seating.lockedSeats);
  const byId = new Map(doc.students.map((student) => [student.id, student]));
  const nameOf = (id: string) => byId.get(id)?.name ?? 'A teammate';
  const levelOf = (id: string): Level => byId.get(id)?.level ?? 3;
  const seatOf = (id: string) => Object.keys(assignment).find((seat) => assignment[seat] === id);
  const sentence = (item: CheckItem) => checkSentence(item, { nameOf, levelOf, labelOf: (seatId) => labelOf(labels, seatId) });

  const undoable: Undoable = useMemo(
    () => ({ seating: doc.seating, room: doc.room, feedback: doc.settings.feedback }),
    [doc.seating, doc.room, doc.settings.feedback],
  );
  const apply = useCallback(
    (value: Undoable) => {
      // A message about the undone change would no longer be true.
      setShowResult(false);
      setOpenBeforeFix(null);
      update((current) => ({
        ...current,
        seating: value.seating,
        room: value.room,
        settings: { ...current.settings, feedback: value.feedback },
      }));
    },
    [update],
  );
  const { undo, canUndo } = useRoomHistory(undoable, apply, busy);

  // Any edit makes the last "Placed…" message out of date.
  const edit = (change: (current: ClassroomDocument) => ClassroomDocument) => {
    setShowResult(false);
    setOpenBeforeFix(null);
    update(change);
  };

  const goTo = (key: SeatPartKey) => {
    setPicked(null);
    setPickedSeat(null);
    setSelectedCheck(null);
    setShowResult(false);
    setParams({ part: key }, { state: location.state });
  };

  // Runs on the class as it is when the engine starts, so nothing done meanwhile is lost.
  const seatClass = (how: (current: ClassroomDocument, room: Room) => ClassroomDocument, says: 'placed' | 'fixed' = 'placed') => {
    setBusy(true);
    setShowResult(false);
    if (says === 'placed') setOpenBeforeFix(null);
    window.setTimeout(() => {
      update((current) => how(current, engineRoom(current.room)));
      setShowResult(says === 'placed');
      setBusy(false);
    }, PAINT_DELAY_MS);
  };

  useOutsideTap(pickedSeat !== null, '[data-seat-label], [data-keep-selection]', () => setPickedSeat(null));

  const { drag, chipProps, ghostRef } = useChipDrag((studentId, zone) => {
    if (zone === 'unseated') edit((current) => unseat(current, studentId));
    else if (zone.startsWith('seat:')) edit((current) => moveStudent(current, studentId, zone.slice('seat:'.length)));
  });

  const openItem = items.find((item) => item.key === selectedCheck && !checkedOff.has(item.key));
  const suggestions: SwapSuggestion[] = useMemo(() => {
    if (!openItem || part !== 'check') return [];
    return suggestSwaps(checkInput(doc, room), currentAssignment(doc), openItem, {
      locked: lockedAssignment(doc),
      checkedOff: new Set(doc.seating.checkedOff),
    });
  }, [openItem, part, doc, room]);

  // While private, nothing on the drawing hints at who is flagged.
  const highlight = new Set(part === 'check' && !hidden ? (openItem?.seatIds ?? []) : []);
  const unseated = doc.students.filter((student) => !seatOf(student.id));
  const pickedStudent = picked ? byId.get(picked) : undefined;
  const pickedStudentSeat = pickedStudent ? seatOf(pickedStudent.id) : undefined;
  const result = showResult ? placedMessage(doc, items, hidden) : '';

  const swapWith = (otherId: string) => {
    if (!picked) return;
    const theirSeat = seatOf(otherId);
    const mySeat = seatOf(picked);
    if (theirSeat) edit((current) => moveStudent(current, picked, theirSeat));
    else if (mySeat) edit((current) => moveStudent(current, otherId, mySeat));
  };

  const places = useMemo(() => namePlaces(doc.room), [doc.room]);
  const shown = useMemo(() => shownNames(doc.students), [doc.students]);
  const placeOf = (seatId: string) => places.get(seatId) ?? { x: 0, y: 0, width: deskUnit(doc.room) };
  const shownNameOf = (studentId: string) => shown.get(studentId) ?? nameOf(studentId);

  const labelSeat = !hidden && part === 'labels' ? doc.room.seats.find((seat) => seat.id === pickedSeat) : undefined;
  const noSeats = doc.room.seats.length === 0;
  const noStudents = doc.students.length === 0;
  const unit = deskUnit(doc.room);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-5">
      <StepHeader step={STEP} title={TITLES[part]} />
      <PartProgress parts={SEAT_PARTS} current={part} onGo={goTo} />

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-card p-4">
          <RoomDrawing
            // A new part starts at the whole room, not the last zoom.
            key={part}
            actions={
              <Button variant="secondary" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <IconArrowBackUp className="size-5" aria-hidden />
                Undo
              </Button>
            }
            room={doc.room}
            showLayout
            toolbarAnchor={labelSeat}
            toolbar={
              labelSeat ? (
                <LabelPicker
                  current={labelOf(labels, labelSeat.id)}
                  onPick={(level) => {
                    edit((current) => setLabel(current, labelSeat.id, level));
                    setPickedSeat(null);
                  }}
                />
              ) : undefined
            }
            emptyMessage={noSeats ? 'Pick your layout first' : undefined}
            seatLayer={
              noSeats ? undefined : part === 'labels' ? (
                <SeatLayer
                  mode="labels"
                  seats={doc.room.seats}
                  unit={unit}
                  labels={labels}
                  hidden={hidden}
                  picked={pickedSeat}
                  onPick={(seatId) => setPickedSeat((current) => (current === seatId ? null : seatId))}
                />
              ) : (
                <SeatLayer
                  mode="students"
                  seats={doc.room.seats}
                  unit={unit}
                  labels={labels}
                  hidden={hidden}
                  assignment={assignment}
                  nameOf={nameOf}
                  levelOf={levelOf}
                  locked={lockedSeats}
                  selected={part === 'students' ? picked : null}
                  onPick={(id) => part === 'students' && setPicked((current) => (current === id ? null : id))}
                  onPlace={
                    part === 'students' && picked
                      ? (seatId) => {
                          edit((current) => moveStudent(current, picked, seatId));
                          setPicked(null);
                        }
                      : undefined
                  }
                  highlight={highlight}
                  draggingLevel={drag && !hidden ? levelOf(drag.id) : null}
                  placeOf={placeOf}
                  shownNameOf={shownNameOf}
                  chipProps={chipProps}
                />
              )
            }
          />
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border-2 border-line bg-card p-4 md:sticky md:top-4 print:hidden">
          {noSeats ? (
            <Link to={DESKS_PART_PATH} className="inline-flex min-h-11 items-center text-base font-semibold text-sage-ink">
              Pick a layout first →
            </Link>
          ) : noStudents ? (
            <Link to={NAMES_PART_PATH} className="inline-flex min-h-11 items-center text-base font-semibold text-sage-ink">
              Add your team first →
            </Link>
          ) : (
            <>
              {part === 'labels' &&
                (hidden ? (
                  <PrivateCover />
                ) : (
                  <LabelsPart
                    labels={labels}
                    levelOnes={doc.students.filter((student) => student.level === 1).length}
                    handSet={doc.room.handSetLabels.length > 0}
                    onReset={() => edit(resetLabels)}
                  />
                ))}

              {part === 'students' && (
                <StudentsPart
                  doc={doc}
                  hidden={hidden}
                  busy={busy}
                  result={result}
                  seated={Object.keys(assignment).length > 0}
                  seatedCount={Object.keys(assignment).length}
                  classSize={doc.students.length}
                  lockedCount={lockedSeats.size}
                  unseated={unseated}
                  picked={pickedStudent}
                  pickedSeatLabel={pickedStudentSeat ? labelOf(labels, pickedStudentSeat) : null}
                  pickedLocked={pickedStudentSeat ? lockedSeats.has(pickedStudentSeat) : false}
                  dropOver={drag?.over === 'unseated'}
                  chipProps={chipProps}
                  onPlace={() => seatClass(placeAll)}
                  onShuffle={() => seatClass((current, seatRoom) => shuffleAll(current, seatRoom))}
                  onUnlockAll={() => edit(unlockAll)}
                  onSettings={(settings) => edit((current) => ({ ...current, settings: { ...current.settings, ...settings } }))}
                  onReviewLevels={() => navigate(CHECK_PART_PATH, { state: { returnTo: `${location.pathname}${location.search}` } })}
                  onPick={setPicked}
                  onLock={() => pickedStudentSeat && edit((current) => toggleLock(current, pickedStudentSeat))}
                  onUnseat={() => pickedStudent && edit((current) => unseat(current, pickedStudent.id))}
                  onSwap={swapWith}
                  details={pickedStudent ? studentDetails(doc, room, pickedStudent.id) : { neighbors: [], needs: [] }}
                  onEdit={() => setEditing(pickedStudent?.id ?? null)}
                />
              )}

              {part === 'check' &&
                (hidden ? (
                  <PrivateCover />
                ) : (
                  <>
                    <p className="text-sm text-ink-muted empty:hidden" role="status">
                      {result}
                    </p>
                    <CheckPart
                      items={items}
                      checkedOff={checkedOff}
                      sentence={sentence}
                      nameOf={nameOf}
                      selected={openItem?.key ?? null}
                      onSelect={setSelectedCheck}
                      suggestions={suggestions}
                      onSwap={(suggestion) => {
                        edit((current) => applySuggestion(current, suggestion));
                        setSelectedCheck(null);
                      }}
                      onGotIt={(key) => {
                        edit((current) => toggleCheckedOff(current, room, key));
                        if (key === selectedCheck) setSelectedCheck(null);
                      }}
                      feedback={feedbackOf(doc)}
                      onFeedback={(key) => seatClass((current, seatRoom) => nudgeFeedback(current, seatRoom, key))}
                      busy={busy}
                      onFixAll={() => {
                        setOpenBeforeFix(items.filter((item) => !checkedOff.has(item.key)).length);
                        seatClass(fixAll, 'fixed');
                      }}
                      onFrontLayouts={() => setLayoutRequest({ kind: 'front' })}
                      fixedMessage={fixedMessage(openBeforeFix, items.filter((item) => !checkedOff.has(item.key)).length)}
                    />
                    <LayoutFinder
                      library={library}
                      failed={libraryFailed}
                      request={layoutRequest}
                      onRequestHandled={() => setLayoutRequest(null)}
                      doc={doc}
                      busy={busy}
                      onTry={(layout, current) =>
                        seatClass((now) => {
                          const switched = switchLayout(now, layout, current);
                          return placeAll(switched, engineRoom(switched.room));
                        })
                      }
                    />
                  </>
                ))}
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-4">
            {before ? (
              <Button variant="secondary" onClick={() => goTo(before.key)}>
                <IconArrowLeft className="size-5" aria-hidden />
                Back
              </Button>
            ) : (
              previous && (
                <Button variant="secondary" onClick={() => navigate(DESKS_PART_PATH)}>
                  <IconArrowLeft className="size-5" aria-hidden />
                  {previous.label}
                </Button>
              )
            )}
            {after ? (
              <Button onClick={() => goTo(after.key)}>
                Next: {after.label.charAt(0).toLowerCase() + after.label.slice(1)}
                <IconArrowRight className="size-5" aria-hidden />
              </Button>
            ) : (
              next && (
                <Button onClick={() => navigate(next.path)}>
                  Next: {next.label}
                  <IconArrowRight className="size-5" aria-hidden />
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {editing && <StudentPanel studentId={editing} onClose={() => setEditing(null)} />}

      {drag && (
        <div
          ref={ghostRef}
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[130%] rounded-full border-2 border-sage bg-card px-3 py-1 text-sm font-semibold shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.name}
          <span className="ml-2 font-medium text-ink-muted empty:hidden">{dragHintFor(drag, labels, levelOf(drag.id), hidden)}</span>
        </div>
      )}
    </section>
  );
}
