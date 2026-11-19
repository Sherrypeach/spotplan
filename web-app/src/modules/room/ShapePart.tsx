import { Chip } from '@components/Chip';
import { IconArmchair, IconArrowsSplit, IconDoor, IconPlus, IconRotateClockwise2, IconWindow, IconX } from '@tabler/icons-react';

import { Button } from '@components/Button';
import { Lockable } from '@components/Lockable';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { RoomCorner, WallSide } from '@modules/classroom/document';
import { FeetStepper } from '@modules/room/FeetStepper';
import { cutFeetRange, setCutCorner, setCutFeet, setRoomFeet, setRoomShape } from '@modules/room/roomEdits';
import { MAX_FEET, MIN_FEET, toFeet } from '@modules/room/units';
import { BOARD_WALLS } from '@modules/room/boardWall';
import { frontOf } from '@modules/room/frontFrame';
import { addChair, addFurniture, canAddChair, canRejoinChair, rejoinChair, canAddFurniture, canSplitFurniture, splitFurniture, FURNITURE, furnitureKindsList, furnitureName, furnitureOf, removeFurniture, turnFurniture } from '@modules/room/furniture';
import { addFeature, MAX_FEATURES, removeFeature, wallFeatures } from '@modules/room/wallFeatures';

const SHAPES = [
  { shape: 'rectangle', label: 'Rectangle', path: 'M4 6h32v24H4z' },
  { shape: 'l-shape', label: 'L-shaped', path: 'M4 6h32v14H22v10H4z' },
] as const;

const CORNER_LABELS: { corner: RoomCorner; label: string }[] = [
  { corner: 'top-left', label: 'Front left' },
  { corner: 'top-right', label: 'Front right' },
  { corner: 'bottom-left', label: 'Back left' },
  { corner: 'bottom-right', label: 'Back right' },
];

const CHOICE = 'flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-2 text-base font-medium';
const CHOICE_ON = 'border-sage bg-sage-soft text-sage-ink';
const CHOICE_OFF = 'border-field-border bg-card hover:border-sage-line';

/** Part 1: the room's shape and size, in feet. */
type Props = {
  /** Moves the board to another wall; missing while the room is locked. */
  onBoardWall?: (wall: WallSide) => void;
};

export function ShapePart({ onBoardWall }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const { room } = doc;
  const isL = room.shape === 'l-shape';
  const cutWidth = cutFeetRange(room.width);
  const cutDepth = cutFeetRange(room.depth);
  const features = wallFeatures(room);
  const furniture = furnitureOf(room);
  // With the board on a side wall, the room's width runs front to back.
  const boardOnSide = frontOf(room) === 'left' || frontOf(room) === 'right';

  return (
    <Lockable locked={room.locked} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">Shape</legend>
        <div className="grid grid-cols-2 gap-2">
          {SHAPES.map(({ shape, label, path }) => {
            const on = shape === 'rectangle' ? !isL : isL;
            return (
              <button
                key={shape}
                type="button"
                aria-pressed={on}
                onClick={() => update((current) => setRoomShape(current, shape))}
                className={`${CHOICE} ${on ? CHOICE_ON : CHOICE_OFF}`}
              >
                <svg viewBox="0 0 40 36" className="h-9 w-10" aria-hidden>
                  <path d={path} fill="var(--color-paper)" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
                  <path d="M4 6h32" stroke="var(--color-sage-ink)" strokeWidth={4} strokeLinecap="round" />
                </svg>
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <FeetStepper
        label={boardOnSide ? 'Front to back' : 'Side to side'}
        feet={toFeet(room.width)}
        min={MIN_FEET}
        max={MAX_FEET}
        onChange={(feet) => update((current) => setRoomFeet(current, { width: feet }))}
      />
      <FeetStepper
        label={boardOnSide ? 'Side to side' : 'Front to back'}
        feet={toFeet(room.depth)}
        min={MIN_FEET}
        max={MAX_FEET}
        onChange={(feet) => update((current) => setRoomFeet(current, { depth: feet }))}
      />
      <p className="text-base text-ink-muted">You can also drag the circles on the walls. Don’t know the exact size? A good guess works.</p>

      <fieldset className="flex flex-col gap-2 border-t-2 border-line pt-4">
        <legend className="mb-2 text-base font-medium">Which wall is the screen on?</legend>
        <div className="flex flex-wrap gap-2">
          {BOARD_WALLS.map(({ wall, label }) => {
            const on = frontOf(room) === wall;
            return (
              <Chip key={wall} pressed={on} disabled={!onBoardWall} onClick={() => onBoardWall?.(wall)}>
                {label}
              </Chip>
            );
          })}
        </div>
        <p className="text-sm text-ink-muted">That wall is the front: the desks turn to face it. You can also drag the screen.</p>
      </fieldset>

      <section aria-label="Doors and windows" className="flex flex-col gap-2 border-t-2 border-line pt-4">
        <h2 className="text-base font-medium">Doors and windows</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => update((current) => ({ ...current, room: addFeature(current.room, 'door') }))} disabled={features.length >= MAX_FEATURES}>
            <IconDoor className="size-5" aria-hidden />
            Add a door
          </Button>
          <Button variant="secondary" onClick={() => update((current) => ({ ...current, room: addFeature(current.room, 'window') }))} disabled={features.length >= MAX_FEATURES}>
            <IconWindow className="size-5" aria-hidden />
            Add a window
          </Button>
        </div>
        {features.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2">
              {features.map((piece, index) => (
                <li key={piece.id} className="flex items-center gap-1 rounded-full border-2 border-sage-line bg-card py-0.5 pr-1 pl-3 text-sm font-medium">
                  {piece.kind === 'door' ? 'Door' : 'Window'} {features.filter((other, i) => other.kind === piece.kind && i <= index).length}
                  <button
                    type="button"
                    onClick={() => update((current) => ({ ...current, room: removeFeature(current.room, piece.id) }))}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-hover"
                  >
                    <IconX className="size-4" aria-hidden />
                    <span className="sr-only">Remove this {piece.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">Drag the round handle along the walls to where each one really is. It can go around corners too.</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">The door helps seat teammates who need to be near it, and shows on the chart.</p>
        )}
      </section>

      <section aria-label="Your furniture" className="flex flex-col gap-2 border-t-2 border-line pt-4">
        <h2 className="text-base font-medium">Your furniture</h2>
        <div className="flex flex-wrap gap-2">
          {FURNITURE.map((entry) => (
            <Button
              key={entry.kind}
              variant="secondary"
              onClick={() => update((current) => ({ ...current, room: addFurniture(current.room, entry.kind) }))}
              disabled={room.locked || !canAddFurniture(room)}
            >
              <IconPlus className="size-5" aria-hidden />
              {entry.label}
            </Button>
          ))}
        </div>
        {furniture.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2">
              {/* A chair still joined to its desk goes with the desk's chip. */}
              {furniture.filter((piece) => !piece.group || piece.group === piece.id).map((piece) => (
                <li key={piece.id} className="flex items-center gap-1 rounded-full border-2 border-sage-line bg-card py-0.5 pr-1 pl-3 text-sm font-medium">
                  {furnitureName(room, piece)}
                  {canRejoinChair(room, piece) && (
                    <button
                      type="button"
                      onClick={() => update((current) => ({ ...current, room: rejoinChair(current.room, piece.id) }))}
                      className="flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 hover:bg-hover"
                    >
                      <IconArmchair className="size-4" aria-hidden />
                      {piece.kind === 'teacher-chair' ? 'Back to desk' : 'Chair in'}
                    </button>
                  )}
                  {canAddChair(room, piece) && (
                    <button
                      type="button"
                      onClick={() => update((current) => ({ ...current, room: addChair(current.room, piece.id) }))}
                      className="flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 hover:bg-hover"
                    >
                      <IconArmchair className="size-4" aria-hidden />
                      Add chair
                      <span className="sr-only">to {furnitureName(room, piece)}</span>
                    </button>
                  )}
                  {canSplitFurniture(room, piece) && (
                    <button
                      type="button"
                      disabled={room.locked}
                      onClick={() => update((current) => ({ ...current, room: splitFurniture(current.room, piece.id) }))}
                      className="flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <IconArrowsSplit className="size-4" aria-hidden />
                      {piece.kind === 'teacher-desk' ? 'Chair out' : 'Split'}
                      <span className="sr-only"> from {furnitureName(room, piece)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={room.locked}
                    onClick={() => update((current) => ({ ...current, room: turnFurniture(current.room, piece.id) }))}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <IconRotateClockwise2 className="size-4" aria-hidden />
                    <span className="sr-only">Turn {furnitureName(room, piece)}</span>
                  </button>
                  <button
                    type="button"
                    disabled={room.locked}
                    onClick={() => update((current) => ({ ...current, room: removeFurniture(current.room, piece.id) }))}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <IconX className="size-4" aria-hidden />
                    <span className="sr-only">Remove {furnitureName(room, piece)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">Drag each one to where it really is, and press R to turn it. Desks on your desk or table turn red (sitting around the rug is fine). In Where I work, say how much time you spend at each.</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">Add the places you spend time, like {furnitureKindsList()}, so the 1s can sit close to them.</p>
        )}
      </section>

      {isL && (
        <div className="flex flex-col gap-4 border-t-2 border-line pt-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-medium">Which corner is missing?</legend>
            <div className="grid grid-cols-2 gap-2">
              {CORNER_LABELS.map(({ corner, label }) => {
                const on = room.cutCorner === corner;
                return (
                  <button
                    key={corner}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update((current) => setCutCorner(current, corner))}
                    className={`${CHOICE} min-h-11 justify-center ${on ? CHOICE_ON : CHOICE_OFF}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-ink-muted">You can also tap a corner on the drawing.</p>
          </fieldset>
          <FeetStepper
            label="Missing corner, side to side"
            feet={toFeet(room.cutWidth ?? 0)}
            min={cutWidth.min}
            max={cutWidth.max}
            onChange={(feet) => update((current) => setCutFeet(current, { width: feet }))}
          />
          <FeetStepper
            label="Missing corner, front to back"
            feet={toFeet(room.cutDepth ?? 0)}
            min={cutDepth.min}
            max={cutDepth.max}
            onChange={(feet) => update((current) => setCutFeet(current, { depth: feet }))}
          />
        </div>
      )}

    </Lockable>
  );
}
