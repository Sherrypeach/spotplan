import { IconArrowsMove } from '@tabler/icons-react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import type { DocPiece } from '@modules/classroom/document';
import { TOUCH_RADIUS_PX, useDrawingScale } from '@modules/room/drawingScale';
import { INWARD } from '@modules/room/frontFrame';

type Props = {
  features: DocPiece[];
  /** Makes doors and windows draggable along the walls (the Shape part). */
  onGrab?: (id: string, event: ReactPointerEvent<SVGElement>) => void;
  /** Moves one with the arrow keys, to this point on its wall. */
  onKeyMove?: (id: string, point: { x: number; y: number }) => void;
  /** Colors as CSS values: the drawing uses theme tokens, the chart fixed colors. */
  colors?: { floor: string; door: string; window: string; windowEdge: string; label: string };
  /** How big labels are, in room units. */
  labelSize: number;
};

const THEME = {
  floor: 'var(--color-paper)',
  door: 'var(--color-desk-edge)',
  window: 'var(--color-tag-blue)',
  windowEdge: 'var(--color-field-border)',
  label: 'var(--color-ink-muted)',
};

/**
 * Doors and windows on the walls, seen from above: a door is a gap in the
 * wall with the arc it swings through; a window is a pale blue bar.
 */
export function WallFeaturesLayer({ features, onGrab, onKeyMove, colors = THEME, labelSize }: Props) {
  // The round handle that says "drag me", and how far one arrow key press slides.
  const handle = labelSize * 0.9;
  const reach = Math.max(handle * 1.2, TOUCH_RADIUS_PX / useDrawingScale());
  const step = labelSize * 0.7;
  return (
    <g>
      {features.map((piece, index) => {
        const across = piece.wall === 'left' || piece.wall === 'right';
        const half = piece.w / 2;
        // Unit vectors along the wall, and into the room.
        const along = across ? { x: 0, y: 1 } : { x: 1, y: 0 };
        const inward = INWARD[piece.wall ?? 'top'];
        const wallX = piece.x - inward.x * (piece.h / 2);
        const wallY = piece.y - inward.y * (piece.h / 2);
        const start = { x: wallX - along.x * half, y: wallY - along.y * half };
        const end = { x: wallX + along.x * half, y: wallY + along.y * half };
        const name = piece.kind === 'door' ? 'Door' : 'Window';
        const sameKind = features.slice(0, index + 1).filter((other) => other.kind === piece.kind).length;
        const onKeyDown = (event: ReactKeyboardEvent<SVGElement>) => {
          const by = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
          if (!by || !onKeyMove) return;
          event.preventDefault();
          onKeyMove(piece.id, { x: piece.x + along.x * by * step, y: piece.y + along.y * by * step });
        };
        const grab = onGrab
          ? {
              'data-piece': piece.id,
              className: 'cursor-grab outline-none active:cursor-grabbing',
              style: { touchAction: 'none' as const },
              role: 'button',
              tabIndex: 0,
              'aria-label': `${name} ${sameKind}. Drag it to any wall, or slide it along this one with the arrow keys`,
              onPointerDown: (event: ReactPointerEvent<SVGElement>) => onGrab(piece.id, event),
              onKeyDown,
            }
          : {};
        const labelAt = onGrab ? handle * 2.4 : labelSize * 1.2;
        // A wide invisible target along the whole piece, and a handle in the middle.
        const grabbable = onGrab && (
          <>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={reach * 2} strokeLinecap="round" />
            <circle className="focus-ring" cx={wallX} cy={wallY} r={handle * 1.4} fill="none" vectorEffect="non-scaling-stroke" />
            <circle cx={wallX} cy={wallY} r={handle} fill="var(--color-card)" stroke="var(--color-sage)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <IconArrowsMove x={wallX - handle * 0.65} y={wallY - handle * 0.65} width={handle * 1.3} height={handle * 1.3} color="var(--color-sage-ink)" pointerEvents="none" />
          </>
        );
        const label = (
          <text
            x={wallX + inward.x * labelAt}
            y={wallY + inward.y * labelAt}
            // On a side wall the word reads into the room from the wall, so it never crosses it.
            textAnchor={!across ? 'middle' : inward.x > 0 ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={labelSize}
            fontWeight={600}
            fill={colors.label}
            pointerEvents="none"
          >
            {name}
          </text>
        );
        if (piece.kind === 'window') {
          return (
            <g key={piece.id} {...grab}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={colors.windowEdge} strokeWidth={piece.h * 0.9} strokeLinecap="round" />
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={colors.window} strokeWidth={piece.h * 0.55} strokeLinecap="round" />
              {label}
              {grabbable}
            </g>
          );
        }
        // The door swings into the room from its first edge.
        const leaf = { x: start.x + inward.x * piece.w, y: start.y + inward.y * piece.w };
        const sweep = (across ? inward.x * along.y : -inward.y * along.x) > 0 ? 1 : 0;
        return (
          <g key={piece.id} {...grab}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={colors.floor} strokeWidth={piece.h * 1.4} />
            <line x1={start.x} y1={start.y} x2={leaf.x} y2={leaf.y} stroke={colors.door} strokeWidth={piece.h * 0.35} strokeLinecap="round" />
            <path
              d={`M ${leaf.x} ${leaf.y} A ${piece.w} ${piece.w} 0 0 ${sweep} ${end.x} ${end.y}`}
              fill="none"
              stroke={colors.door}
              strokeWidth={piece.h * 0.2}
              strokeDasharray={`${piece.h * 0.6} ${piece.h * 0.4}`}
            />
            {label}
            {grabbable}
          </g>
        );
      })}
    </g>
  );
}
