import { IconArrowBackUp, IconArrowLeft, IconArrowRight, IconLoader2, IconLock } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@components/Button';
import { PartProgress } from '@components/PartProgress';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocRoom, DocSpot, RoomCorner, WallSide } from '@modules/classroom/document';
import { setBoardWall } from '@modules/room/boardWall';
import type { LayoutCategory } from '@modules/layouts/types';
import { DesksPart } from '@modules/room/DesksPart';
import { FloatingTools } from '@modules/room/FloatingTools';
import { addChair, canAddChair, canRejoinChair, canSplitFurniture, rejoinChair, furnitureName, isFurniture, moveFurniture, removeFurniture, splitFurniture, turnFurniture } from '@modules/room/furniture';
import { layoutName } from '@modules/layouts/layoutName';
import { chooseLayout, moveSpot, piecesOutsideWalls, piecesOverlapping, removeSpot, rugOf } from '@modules/room/layoutPlacement';
import { isRoomPartKey, ROOM_PARTS, type RoomPartKey } from '@modules/room/parts';
import { RoomDrawing, type PieceControls, type SpotControls } from '@modules/room/RoomDrawing';
import { resetRoom, setCutCorner, setRoomFeet } from '@modules/room/roomEdits';
import { copySelection, moveSelection, pieceGroups, removeSelection, selectionAfterClick, splitSelection, turnSelection } from '@modules/room/selection';
import { ShapePart } from '@modules/room/ShapePart';
import { StartOver } from '@modules/room/StartOver';
import { useLayoutLibrary } from '@modules/room/useLayoutLibrary';
import { useRoomHistory } from '@modules/room/useRoomHistory';
import { StepHeader } from '@modules/steps/StepHeader';
import { TeachPart } from '@modules/room/TeachPart';
import { addTeacherSpot, moveTeacherSpot, removeTeacherSpot, setSpotTime } from '@modules/room/teacherSpots';
import { moveFeature } from '@modules/room/wallFeatures';
import { count } from '@shared/text';
import { useOutsideTap } from '@shared/useOutsideTap';
import { nextStep, previousStep, STEPS } from '@modules/steps/steps';

const STEP = STEPS[1];

const TITLES: Record<RoomPartKey, string> = {
  shape: 'Draw your room',
  desks: 'Choose a desk layout',
  teach: 'Where do you usually work from?',
};

function describe(room: DocRoom, selected: string[]): string {
  const seats = room.seats.filter((seat) => selected.includes(seat.furnitureId)).length;
  const pieces = room.pieces.filter((piece) => selected.includes(piece.id));
  const allDesks = pieces.every((piece) => piece.kind === 'desk');
  const what = pieces.some((piece) => piece.kind === 'carpet')
    ? 'Rug'
    : allDesks
      ? pieces.length === 1
        ? 'Desk'
        : `${pieces.length} desks`
      : 'Table';
  return `${what} · ${count(seats, what === 'Rug' ? 'rug seat' : 'seat')}`;
}

/**
 * Step 2: the room drawing on the left, the open part's controls on the
 * right (below the drawing on narrow screens), with Next always at the
 * bottom of the controls.
 */
export function RoomStep() {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const requested = params.get('part');
  const part: RoomPartKey = isRoomPartKey(requested) ? requested : 'shape';
  const index = ROOM_PARTS.findIndex((candidate) => candidate.key === part);
  const before = ROOM_PARTS[index - 1];
  const after = ROOM_PARTS[index + 1];
  const previous = previousStep(STEP);
  const next = nextStep(STEP);

  const { library, failed } = useLayoutLibrary();
  const applyRoom = useCallback((room: DocRoom) => update((current) => ({ ...current, room })), [update]);
  const { undo, canUndo } = useRoomHistory(doc.room, applyRoom);
  // The kind of seating offered: the current layout's until another is picked.
  const [pickedKind, setPickedKind] = useState<LayoutCategory | null>(null);
  const currentLayout = library?.layouts.find((layout) => layout.id === doc.room.layout?.id) ?? null;
  const currentKind = currentLayout?.category ?? null;
  const moveBoard = (wall: WallSide) => update((current) => setBoardWall(current, wall, currentLayout));
  // A new layout (picked, or brought back by Undo) shows its own kind again.
  const [kindOf, setKindOf] = useState(currentKind);
  if (kindOf !== currentKind) {
    setKindOf(currentKind);
    setPickedKind(null);
  }
  const kind = pickedKind ?? currentKind ?? 'desks';
  const browsing = doc.room.layout !== null && currentKind !== null && kind !== currentKind;
  // A layout tried on before it's used: shown in the room, saved only when the teacher uses it.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewPart, setPreviewPart] = useState(part);
  if (previewPart !== part) {
    setPreviewPart(part);
    setPreviewId(null);
  }
  const previewLayout = part === 'desks' ? (library?.layouts.find((layout) => layout.id === previewId && layout.id !== currentLayout?.id) ?? null) : null;
  const preview = useMemo(() => {
    if (!previewLayout) return null;
    const room = chooseLayout(doc.room, previewLayout, currentLayout);
    return { layout: previewLayout, room, problems: new Set([...piecesOutsideWalls(room), ...piecesOverlapping(room)]) };
  }, [previewLayout, doc.room, currentLayout]);
  const locked = doc.room.locked;
  // Desks show on the Desks part (unless browsing another kind) and on Where I teach.
  const showLayout = (part === 'desks' && (!browsing || preview !== null)) || part === 'teach';
  const canEdit = part === 'desks' && !browsing && !locked && !preview;
  const [pickedTeacherSpot, setPickedTeacherSpot] = useState<string | null>(null);
  // Where I teach starts with one marker at the front, where most teachers stand:
  // once per visit, so Undo and Start over can still empty the list.
  const hasMarker = (spots: DocSpot[]) => spots.some((spot) => !spot.pieceId);
  const needsFirstSpot = part === 'teach' && !hasMarker(doc.room.spots);
  const firstSpotAdded = useRef(false);
  useEffect(() => {
    if (part !== 'teach') firstSpotAdded.current = false;
    if (!needsFirstSpot || firstSpotAdded.current) return;
    firstSpotAdded.current = true;
    update((current) => (hasMarker(current.room.spots) ? current : { ...current, room: addTeacherSpot(current.room) }));
  }, [part, needsFirstSpot, update]);
  const outside = useMemo(() => new Set(piecesOutsideWalls(doc.room)), [doc.room]);
  const overlapping = useMemo(() => new Set(piecesOverlapping(doc.room)), [doc.room]);
  const problems = useMemo(() => new Set([...outside, ...overlapping]), [outside, overlapping]);
  const groups = useMemo(() => pieceGroups(doc.room), [doc.room]);
  const focusable = useMemo(() => new Set([...groups.values()].map((members) => members[0])), [groups]);

  const [picked, setPicked] = useState<string[]>([]);
  const [pickedSpot, setPickedSpot] = useState<string | null>(null);
  const [pickedFurniture, setPickedFurniture] = useState<string | null>(null);
  const furniturePiece = (part === 'shape' || part === 'desks') && !locked ? doc.room.pieces.find((piece) => piece.id === pickedFurniture && isFurniture(piece)) : undefined;
  const selected = part === 'desks' ? picked.filter((id) => doc.room.pieces.some((piece) => piece.id === id)) : [];
  const spot = part === 'desks' && doc.room.seats.some((seat) => seat.id === pickedSpot) ? pickedSpot : null;
  const editRoom = (edit: (room: DocRoom) => DocRoom) => update((current) => ({ ...current, room: edit(current.room) }));

  const putDown = () => {
    setPicked([]);
    setPickedSpot(null);
    setPickedFurniture(null);
  };
  const removeSelected = () => {
    editRoom((room) => removeSelection(room, selected));
    setPicked([]);
  };
  const copySelected = () => {
    const result = copySelection(doc.room, selected);
    if (result.copied.length === 0) return;
    editRoom(() => result.room);
    setPicked(result.copied);
  };

  const pieceControls: PieceControls | undefined =
    canEdit && doc.room.layout
      ? {
          selected,
          dragIdsFor: (id) => (selected.includes(id) ? selected : (groups.get(id) ?? [id])),
          focusable,
          onClick: (id) => {
            setPickedSpot(null);
            setPicked(id ? selectionAfterClick(doc.room, selected, id) : []);
          },
          onMove: (ids, dx, dy) => {
            setPickedSpot(null);
            setPicked(ids);
            editRoom((room) => moveSelection(room, ids, dx, dy));
          },
          onSelect: (ids) => {
            setPickedSpot(null);
            setPicked(ids);
          },
          onTurn: (ids, degrees) => editRoom((room) => turnSelection(room, ids, degrees)),
          onRemove: removeSelected,
        }
      : undefined;
  const spotControls: SpotControls | undefined =
    canEdit && rugOf(doc.room)
      ? {
          picked: spot,
          onPick: (id) => {
            setPicked([]);
            setPickedSpot(id);
          },
          onMove: (id, dx, dy) => {
            setPicked([]);
            setPickedSpot(id);
            editRoom((room) => moveSpot(room, id, dx, dy));
          },
          onRemove: () => {
            if (spot) editRoom((room) => removeSpot(room, spot));
            setPickedSpot(null);
          },
        }
      : undefined;

  // A tap anywhere but what's picked up or its tools puts it down; scrolling or panning doesn't.
  useOutsideTap(selected.length > 0 || spot !== null || furniturePiece !== undefined, '[data-piece], [data-keep-selection]', putDown);

  const toolbar = furniturePiece ? (
    <FloatingTools
      label={furnitureName(doc.room, furniturePiece)}
      onTurn={() => editRoom((room) => turnFurniture(room, furniturePiece.id))}
      onSplit={canSplitFurniture(doc.room, furniturePiece) ? () => editRoom((room) => splitFurniture(room, furniturePiece.id)) : undefined}
      splitLabel={furniturePiece.kind === 'teacher-desk' ? 'Chair out' : 'Split'}
      onAddChair={canAddChair(doc.room, furniturePiece) ? () => editRoom((room) => addChair(room, furniturePiece.id)) : undefined}
      onRejoin={canRejoinChair(doc.room, furniturePiece) ? () => editRoom((room) => rejoinChair(room, furniturePiece.id)) : undefined}
      rejoinLabel={furniturePiece.kind === 'teacher-chair' ? 'Back to desk' : 'Chair in'}
      onRemove={() => {
        editRoom((room) => removeFurniture(room, furniturePiece.id));
        setPickedFurniture(null);
      }}
      onDone={putDown}
      hint="Drag to move it. Tap it again to put it down."
    />
  ) : selected.length > 0 ? (
      <FloatingTools
        label={describe(doc.room, selected)}
        onTurn={() => editRoom((room) => turnSelection(room, selected, 90))}
        onCopy={selected.some((id) => doc.room.pieces.find((piece) => piece.id === id)?.kind === 'carpet') ? undefined : copySelected}
        onSplit={
          selected.length > 1
            ? () => {
                editRoom((room) => splitSelection(room, selected));
                setPicked([]);
              }
            : undefined
        }
        onRemove={removeSelected}
        onDone={putDown}
        hint="Drag to move it. Tap it again to put it down."
      />
    ) : spot && spotControls ? (
      <FloatingTools label="Rug seat" onRemove={spotControls.onRemove} onDone={putDown} hint="Drag it anywhere on the rug." />
    ) : undefined;

  const goTo = (key: RoomPartKey) => setParams({ part: key }, { state: location.state });

  const pickCorner =
    part === 'shape' && doc.room.shape === 'l-shape'
      ? (corner: RoomCorner) => update((current) => setCutCorner(current, corner))
      : undefined;

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-5">
      <StepHeader step={STEP} title={TITLES[part]} fixedTip />
      <PartProgress parts={ROOM_PARTS} current={part} onGo={goTo} />

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-card p-4">
          <RoomDrawing
            // A new part starts at the whole room, not the last zoom.
            key={part}
            actions={
              preview ? (
                <p className="rounded-full bg-action-soft px-3 py-1 text-base font-medium text-action-on" role="status">
                  Preview: {layoutName(preview.layout)} in your room
                </p>
              ) : (
              <div className="flex flex-wrap gap-2">
                <StartOver disabled={locked} onStartOver={() => update((current) => ({ ...current, room: resetRoom(current.room) }))} />
                <Button variant="secondary" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                  <IconArrowBackUp className="size-5" aria-hidden />
                  Undo
                </Button>
              </div>
              )
            }
            room={preview?.room ?? doc.room}
            onPickCorner={locked ? undefined : pickCorner}
            onResize={part === 'shape' && !locked ? (size) => update((current) => setRoomFeet(current, size)) : undefined}
            onMoveFeature={part === 'shape' && !locked ? (id, point) => update((current) => ({ ...current, room: moveFeature(current.room, id, point) })) : undefined}
            onBoardWall={part === 'shape' && !locked ? moveBoard : undefined}
            furniture={
              // Your own furniture moves in Shape and next to the desks in Layout.
              (part === 'shape' || (part === 'desks' && !preview)) && !locked
                ? {
                    onMove: (id, point) => update((current) => ({ ...current, room: moveFurniture(current.room, id, point) })),
                    onTurn: (id, degrees) => update((current) => ({ ...current, room: turnFurniture(current.room, id, degrees) })),
                    picked: furniturePiece?.id ?? null,
                    onPick: (id) => {
                      setPicked([]);
                      setPickedSpot(null);
                      setPickedFurniture(id);
                    },
                  }
                : undefined
            }
            teacher={
              part === 'teach'
                ? {
                    selected: pickedTeacherSpot,
                    onSelect: setPickedTeacherSpot,
                    onMove: (id, x, y) => update((current) => ({ ...current, room: moveTeacherSpot(current.room, id, x, y) })),
                  }
                : undefined
            }
            showLayout={showLayout}
            problems={preview ? preview.problems : showLayout ? problems : undefined}
            pieces={pieceControls}
            spots={spotControls}
            toolbar={toolbar}
            emptyMessage={part === 'desks' && !preview && (!doc.room.layout || browsing) ? 'Select an option' : undefined}
          />
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border-2 border-line bg-card p-4 md:sticky md:top-4">
          {locked && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sage-mist px-3 py-2 text-base" role="status">
              <span className="flex items-center gap-2 font-medium text-sage-ink">
                <IconLock className="size-5" aria-hidden />
                Your room is locked, so desks can’t move by accident.
              </span>
              <Button variant="secondary" onClick={() => update((current) => ({ ...current, room: { ...current.room, locked: false } }))}>
                Unlock
              </Button>
            </div>
          )}
          {part === 'shape' && <ShapePart onBoardWall={locked ? undefined : moveBoard} />}
          {part === 'teach' && (
            <TeachPart
              spots={doc.room.spots}
              pieces={doc.room.pieces}
              selected={pickedTeacherSpot}
              onSelect={(id) => setPickedTeacherSpot((current) => (current === id ? null : id))}
              onTime={(id, time) => update((current) => ({ ...current, room: setSpotTime(current.room, id, time) }))}
              onRemove={(id) => update((current) => ({ ...current, room: removeTeacherSpot(current.room, id) }))}
              onAddFurniture={() => goTo('shape')}
            />
          )}
          {part === 'desks' &&
            (library ? (
              <DesksPart
                library={library}
                outsideWalls={outside.size}
                overlapping={overlapping.size}
                kind={kind}
                onKind={(picked) => {
                  setPreviewId(null);
                  setPickedKind(picked);
                }}
                preview={preview && { layout: preview.layout, room: preview.room, problems: preview.problems.size }}
                onPreview={setPreviewId}
              />
            ) : (
              <p className="flex items-center gap-2 text-base text-ink-muted" role="status">
                {failed ? (
                  'We couldn’t load the layouts. Check your connection and reload the page.'
                ) : (
                  <>
                    <IconLoader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
                    Loading layouts…
                  </>
                )}
              </p>
            ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-4 print:hidden">
            {before ? (
              <Button variant="secondary" onClick={() => goTo(before.key)}>
                <IconArrowLeft className="size-5" aria-hidden />
                Back
              </Button>
            ) : (
              previous && (
                <Button variant="secondary" onClick={() => navigate(previous.path)}>
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
                // The last button of the step locks the room, then goes on to Seats.
                <Button
                  onClick={() => {
                    update((current) => ({ ...current, room: { ...current.room, locked: true } }));
                    navigate(next.path);
                  }}
                >
                  <IconLock className="size-5" aria-hidden />
                  Lock in my room
                  <IconArrowRight className="size-5" aria-hidden />
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
