import { IconLock } from '@tabler/icons-react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { DocSeat, SeatAssignment } from '@modules/classroom/document';
import type { Level, SeatLabels } from '@modules/seating/engine';
import { useDrawingScale } from '@modules/room/drawingScale';
import { fits, labelOf } from '@modules/seats/seatingModel';
import type { ChipProps } from '@modules/students/useChipDrag';
import { LETTER_WIDTH } from '@shared/text';

type Props = {
  seats: DocSeat[];
  /** A desk's width in room units, which sets how big labels and names are drawn. */
  unit: number;
  labels: SeatLabels;
  /** Levels and labels are hidden while private info is hidden. */
  hidden: boolean;
} & (
  | { mode: 'labels'; picked: string | null; onPick: (seatId: string) => void }
  | {
      mode: 'students';
      assignment: SeatAssignment;
      nameOf: (studentId: string) => string;
      levelOf: (studentId: string) => Level;
      locked: Set<string>;
      selected: string | null;
      onPick: (studentId: string) => void;
      /** With a student picked, an empty seat can be clicked to move them there. */
      onPlace?: (seatId: string) => void;
      /** Seats to light up, e.g. the ones a check list item is about. */
      highlight: Set<string>;
      /** The level of the student being dragged: seats that fit get a ring. */
      draggingLevel: Level | null;
      /** Where a seat's name goes and how wide it may be: on the desk, flat, never sideways. */
      placeOf: (seatId: string) => { x: number; y: number; width: number };
      /** The name as shown on the drawing: a first name, with a last initial when two share it. */
      shownNameOf: (studentId: string) => string;
      chipProps: (studentId: string, name: string, from: string) => ChipProps;
    }
);

const LEVEL_FILL: Record<Level, string> = { 1: 'var(--color-level-1)', 2: 'var(--color-level-2)', 3: 'var(--color-level-3)' };
const MIN_NAME_PX = 11;
// The colored edge that shows a student's level, as a share of the name's height.
const LEVEL_EDGE = 0.3;
// Names show once at least this share of them fit on their desks.
const NAMES_SHOWN_SHARE = 0.75;
// When a name can't fit on its desk, initials in a circle this big (screen pixels) stand in for it.
const BUBBLE_PX = { min: 9, max: 13 };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? parts.at(-1)!.charAt(0) : ''}`.toUpperCase();
}

function onEnter(action: () => void) {
  return (event: ReactKeyboardEvent<SVGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };
}

/** Seat labels or students' names, drawn on the seats of the room drawing. */
export function SeatLayer(props: Props) {
  const { seats, unit, labels, hidden } = props;
  const pxPerUnit = useDrawingScale();
  const radius = unit * 0.2;

  if (props.mode === 'labels') {
    // Seat labels never print: a chart may end up on the wall.
    return (
      <g className="print:hidden">
        {seats.map((seat) => {
          const label = labelOf(labels, seat.id);
          return (
            <g
              key={seat.id}
              role="button"
              tabIndex={0}
              data-seat-label={seat.id}
              aria-label={hidden ? 'Seat' : `${label} seat. Tap to change`}
              aria-pressed={props.picked === seat.id}
              className="cursor-pointer outline-none"
              onClick={() => !hidden && props.onPick(seat.id)}
              onKeyDown={onEnter(() => !hidden && props.onPick(seat.id))}
            >
              <circle className="focus-ring" cx={seat.x} cy={seat.y} r={radius + 4 / pxPerUnit} fill="none" vectorEffect="non-scaling-stroke" />
              {props.picked === seat.id && (
                <circle cx={seat.x} cy={seat.y} r={radius * 1.6} fill="var(--color-sage)" fillOpacity={0.3} stroke="var(--color-sage)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              )}
              <circle
                cx={seat.x}
                cy={seat.y}
                r={radius}
                fill={hidden ? 'var(--color-line)' : LEVEL_FILL[label]}
                stroke={hidden ? 'var(--color-field-border)' : 'var(--color-stamp-ink)'}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              {!hidden && (
                <text x={seat.x} y={seat.y} textAnchor="middle" dominantBaseline="central" fontSize={radius * 1.2} fontWeight={700} fill="var(--color-stamp-ink)">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  }

  const { assignment, nameOf, levelOf, locked, selected, onPick, onPlace, highlight, draggingLevel, chipProps, placeOf, shownNameOf } = props;
  const baseFont = unit * 0.17;
  // Names never get smaller than this on screen, however far out the room is zoomed.
  const minFont = MIN_NAME_PX / pxPerUnit;

  // Names show once most of them fit (zoomed in far enough); until then every student is initials, never a scattered few names.
  const edgeLetters = hidden ? 0 : 1;
  const nameFits = (seatId: string, studentId: string) =>
    placeOf(seatId).width / ((shownNameOf(studentId).length + edgeLetters) * LETTER_WIDTH + 0.6) >= minFont;
  const seated = seats.filter((seat) => assignment[seat.id]);
  const namesShown = seated.length > 0 && seated.filter((seat) => nameFits(seat.id, assignment[seat.id])).length >= seated.length * NAMES_SHOWN_SHARE;

  return (
    <g>
      {seats.map((seat) => {
        const studentId = assignment[seat.id];
        const label = labelOf(labels, seat.id);
        const ring = (draggingLevel !== null && fits(draggingLevel, label)) || highlight.has(seat.id);
        if (!studentId) {
          const canPlace = Boolean(onPlace && selected);
          return (
            <g
              key={seat.id}
              data-drop-zone={`seat:${seat.id}`}
              role={canPlace ? 'button' : undefined}
              tabIndex={canPlace ? 0 : undefined}
              aria-label={canPlace ? `Empty seat${hidden ? '' : `, a ${label} seat`}. Move ${nameOf(selected!)} here` : undefined}
              className={canPlace ? 'cursor-pointer outline-none' : undefined}
              onClick={canPlace ? () => onPlace!(seat.id) : undefined}
              onKeyDown={canPlace ? onEnter(() => onPlace!(seat.id)) : undefined}
            >
              {canPlace && <circle className="focus-ring" cx={seat.x} cy={seat.y} r={radius * 1.3 + 4 / pxPerUnit} fill="none" vectorEffect="non-scaling-stroke" />}
              <circle
                cx={seat.x}
                cy={seat.y}
                r={canPlace ? radius * 1.3 : radius}
                fill={canPlace ? 'var(--color-sage-mist)' : 'var(--color-card)'}
                stroke={ring || canPlace ? 'var(--color-sage)' : 'var(--color-field-border)'}
                strokeWidth={ring || canPlace ? 3 : 1.5}
                strokeDasharray={ring || canPlace ? undefined : '3 2'}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        }
        const name = nameOf(studentId);
        const shown = shownNameOf(studentId);
        const place = placeOf(seat.id);
        const edge = hidden ? 0 : 1;
        const fitted = place.width / ((shown.length + edge) * LETTER_WIDTH + 0.6);
        // Initials in a circle while names are off, or for the odd long name that still doesn't fit.
        const asBubble = !namesShown || fitted < minFont;
        const font = Math.max(minFont, Math.min(baseFont, fitted));
        const height = font * 1.6;
        const edgeWidth = hidden ? 0 : height * LEVEL_EDGE;
        const width = shown.length * font * LETTER_WIDTH + font * 0.6 + edgeWidth;
        const left = place.x - width / 2;
        const top = place.y - height / 2;
        const level = levelOf(studentId);
        const wrong = !hidden && !fits(level, label);
        const isSelected = selected === studentId;
        const drag = chipProps(studentId, name, `seat:${seat.id}`);
        const groupProps = {
          'data-drop-zone': `seat:${seat.id}`,
          'data-student': studentId,
          role: 'button',
          tabIndex: 0,
          'aria-label': `${name}${hidden ? '' : `, level ${level}, in a ${label} seat${wrong ? ', not a fit' : ''}`}${locked.has(seat.id) ? ', locked' : ''}`,
          'aria-pressed': isSelected,
          className: 'cursor-grab outline-none active:cursor-grabbing',
          onClick: () => onPick(studentId),
          onKeyDown: onEnter(() => onPick(studentId)),
          onPointerDown: drag.onPointerDown,
          onPointerMove: drag.onPointerMove,
          onPointerUp: drag.onPointerUp,
          onPointerCancel: drag.onPointerCancel,
          onClickCapture: drag.onClickCapture,
          // Names never scroll the page on touch, so a held finger can drag them.
          style: { touchAction: 'none' },
        };
        if (asBubble) {
          const r = Math.max(BUBBLE_PX.min / pxPerUnit, Math.min(BUBBLE_PX.max / pxPerUnit, place.width / 2));
          return (
            <g key={seat.id} {...groupProps}>
              <title>{name}</title>
              <circle className="focus-ring" cx={place.x} cy={place.y} r={r + 3 / pxPerUnit} fill="none" vectorEffect="non-scaling-stroke" />
              {(ring || isSelected) && (
                <circle
                  className="print:hidden"
                  cx={place.x}
                  cy={place.y}
                  r={r + 3 / pxPerUnit}
                  fill="none"
                  stroke="var(--color-sage)"
                  strokeOpacity={isSelected ? 1 : 0.6}
                  strokeWidth={isSelected ? 3 : 4}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle
                cx={place.x}
                cy={place.y}
                r={r}
                fill={hidden ? 'var(--color-sage-soft)' : LEVEL_FILL[level]}
                stroke={wrong ? 'var(--color-danger)' : hidden ? 'var(--color-sage-ink)' : 'var(--color-stamp-ink)'}
                strokeWidth={wrong ? 2 : 1}
                strokeDasharray={wrong ? '3 2' : undefined}
                vectorEffect="non-scaling-stroke"
              />
              <text x={place.x} y={place.y} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.95} fontWeight={700} fill={hidden ? 'var(--color-sage-ink)' : 'var(--color-stamp-ink)'} pointerEvents="none">
                {initials(name)}
              </text>
            </g>
          );
        }
        return (
          <g key={seat.id} {...groupProps}>
            <rect className="focus-ring" x={left - 3} y={top - 3} width={width + 6} height={height + 6} rx={4} fill="none" vectorEffect="non-scaling-stroke" />
            {(ring || isSelected) && (
              <rect
                className="print:hidden"
                x={left - 3}
                y={top - 3}
                width={width + 6}
                height={height + 6}
                rx={4}
                fill="none"
                stroke="var(--color-sage)"
                strokeOpacity={isSelected ? 1 : 0.6}
                strokeWidth={isSelected ? 3 : 4}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <rect x={left} y={top} width={width} height={height} rx={3} fill="var(--color-card)" fillOpacity={0.85} />
            {/* Levels never print: a chart may end up on the wall. */}
            {!hidden && <rect className="print:hidden" x={left} y={top} width={edgeWidth} height={height} rx={1.5} fill={LEVEL_FILL[level]} />}
            {wrong && (
              <rect
                className="print:hidden"
                x={left}
                y={top}
                width={width}
                height={height}
                rx={3}
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth={2}
                strokeDasharray="4 2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <text
              x={left + edgeWidth + (width - edgeWidth) / 2}
              y={place.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={font}
              fontWeight={600}
              fill="var(--color-ink)"
              pointerEvents="none"
            >
              {shown}
            </text>
            {locked.has(seat.id) && (
              <IconLock x={left + width - height * 0.1} y={top - height * 0.45} width={height * 0.7} height={height * 0.7} color="var(--color-sage-ink)" pointerEvents="none" />
            )}
          </g>
        );
      })}
    </g>
  );
}
