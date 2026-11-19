import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import type { DocPiece, DocSeat } from '@modules/classroom/document';
import { RugShape } from '@modules/room/RugShape';
import { isShapedRug, pieceOutline } from '@modules/room/roomGeometry';

/** Where pieces being dragged or turned are drawn, and whether they can go there. */
export type Moving = {
  ids: Set<string>;
  dx: number;
  dy: number;
  turn?: { degrees: number; cx: number; cy: number };
  /** Green while it fits, red while it would go through a wall or onto another table. */
  fits?: boolean;
};

type Props = {
  pieces: DocPiece[];
  seats: DocSeat[];
  /** How big a chair is drawn, in room units. */
  chairSize: number;
  /** Pieces drawn with a dashed red outline (through a wall, on furniture). */
  problems?: Set<string>;
  /** Picked-up pieces, with a soft halo. */
  selected?: Set<string>;
  moving?: Moving;
  /** Makes these pieces grabbable (the desks and tables, not the teacher's own furniture). */
  canGrab?: (id: string) => boolean;
  onGrab?: (id: string, event: ReactPointerEvent<SVGElement>) => void;
  /** Keys on a focused piece (Enter picks it up). */
  onPieceKey?: (id: string, event: ReactKeyboardEvent<SVGElement>) => void;
  /** Pieces that take keyboard focus: one per table, so Tab goes table by table. */
  focusable?: Set<string>;
  /** Spots on a rug can be picked up and dragged one by one. */
  spots?: {
    picked: string | null;
    moving: { id: string; dx: number; dy: number } | null;
    onGrab: (id: string, event: ReactPointerEvent<SVGElement>) => void;
    onKey: (id: string, event: ReactKeyboardEvent<SVGElement>) => void;
  };
};

function points(piece: DocPiece): string {
  return pieceOutline(piece)
    .map((corner) => `${corner.x},${corner.y}`)
    .join(' ');
}

function fillOf(piece: DocPiece): string {
  if (piece.kind === 'carpet') return 'var(--color-tag-purple)';
  if (piece.kind === 'storage' || piece.kind === 'supply-desk') return 'var(--color-side)';
  return 'var(--color-desk)';
}

function strokeOf(piece: DocPiece, problem: boolean, moving: Moving | undefined): string {
  if (moving?.ids.has(piece.id) && moving.fits !== undefined) return moving.fits ? 'var(--color-sage)' : 'var(--color-danger)';
  if (problem) return 'var(--color-danger)';
  return piece.kind === 'carpet' ? 'var(--color-field-border)' : 'var(--color-desk-edge)';
}

function describePiece(piece: DocPiece, seats: number): string {
  const what = piece.kind === 'desk' ? 'Desk' : piece.kind === 'carpet' ? 'Rug' : 'Table';
  return `${what}, ${seats} ${seats === 1 ? 'seat' : 'seats'}`;
}

/** An office chair from above: a round seat with a curved back away from the desk. */
function Chair({ seat, size, transform }: { seat: DocSeat; size: number; transform?: string }) {
  const r = size * 0.42;
  const back = `M ${-size * 0.48} ${size * 0.22} Q 0 ${size * 0.72} ${size * 0.48} ${size * 0.22}`;
  return (
    <g transform={transform} pointerEvents="none">
      <g transform={`translate(${seat.x} ${seat.y}) rotate(${seat.facing})`}>
        <circle r={r} fill="var(--color-step-seats)" stroke="var(--color-stamp-ink)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <path d={back} fill="none" stroke="var(--color-sage-ink)" strokeWidth={size * 0.2} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** A monitor and keyboard on the desk, in front of each chair. */
function Workstation({ seat, size, transform }: { seat: DocSeat; size: number; transform?: string }) {
  return (
    <g transform={transform} pointerEvents="none">
      <g transform={`translate(${seat.x} ${seat.y}) rotate(${seat.facing})`}>
        <rect x={-size * 0.42} y={-size * 1.12} width={size * 0.84} height={size * 0.14} rx={size * 0.05} fill="var(--color-sage-ink)" />
        <rect x={-size * 0.3} y={-size * 0.82} width={size * 0.6} height={size * 0.12} rx={size * 0.04} fill="var(--color-desk-edge)" opacity={0.55} />
      </g>
    </g>
  );
}

/**
 * The desks and tables as seen from above: wooden desks with a chair for
 * every seat, rugs with a round spot for every child.
 */
export function PiecesLayer({ pieces, seats, chairSize, problems, selected, moving, canGrab, onGrab, onPieceKey, focusable, spots }: Props) {
  const offset = (id: string) => {
    if (!moving?.ids.has(id)) return undefined;
    const turn = moving.turn ? ` rotate(${moving.turn.degrees} ${moving.turn.cx} ${moving.turn.cy})` : '';
    return `translate(${moving.dx} ${moving.dy})${turn}`;
  };
  const rugIds = new Set(pieces.filter((piece) => piece.kind === 'carpet').map((piece) => piece.id));
  const rugs = pieces.filter((piece) => rugIds.has(piece.id));
  const others = pieces.filter((piece) => !rugIds.has(piece.id));
  const chairs = seats.filter((seat) => !rugIds.has(seat.furnitureId));
  const rugSpots = seats.filter((seat) => rugIds.has(seat.furnitureId));
  const seatCount = (id: string) => seats.filter((seat) => seat.furnitureId === id).length;

  const drawPiece = (piece: DocPiece) => {
    const problem = problems?.has(piece.id) ?? false;
    const picked = selected?.has(piece.id) ?? false;
    const grabbable = Boolean(onGrab && canGrab?.(piece.id));
    const dragged = moving?.ids.has(piece.id) && moving.fits === false;
    const takesFocus = grabbable && (focusable?.has(piece.id) ?? false);
    const look = {
      fill: dragged ? 'var(--color-danger)' : fillOf(piece),
      fillOpacity: piece.kind === 'carpet' ? 0.35 : dragged ? 0.3 : 1,
      stroke: strokeOf(piece, problem, moving),
      strokeWidth: problem || moving?.ids.has(piece.id) ? 2.5 : 1.5,
      strokeDasharray: problem && !picked && !moving?.ids.has(piece.id) ? '5 3' : undefined,
      strokeLinejoin: 'round' as const,
      vectorEffect: 'non-scaling-stroke' as const,
      className: grabbable ? 'cursor-grab outline-none active:cursor-grabbing' : undefined,
      style: grabbable ? { touchAction: 'none' } : undefined,
      'data-piece': grabbable ? piece.id : undefined,
      onPointerDown: grabbable ? (event: ReactPointerEvent<SVGElement>) => onGrab?.(piece.id, event) : undefined,
      tabIndex: takesFocus ? 0 : undefined,
      role: takesFocus ? 'button' : undefined,
      'aria-label': takesFocus ? describePiece(piece, seatCount(piece.id)) : undefined,
      'aria-pressed': takesFocus ? picked : undefined,
      onKeyDown: takesFocus ? (event: ReactKeyboardEvent<SVGElement>) => onPieceKey?.(piece.id, event) : undefined,
    };
    const halo = picked && (
      <polygon
        points={points(piece)}
        transform={offset(piece.id)}
        fill="none"
        stroke="var(--color-sage)"
        strokeOpacity={0.45}
        strokeWidth={10}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    );
    if (isShapedRug(piece)) {
      return (
        <g key={piece.id}>
          {picked && <RugShape rug={piece} transform={offset(piece.id)} fill="none" stroke="var(--color-sage)" strokeOpacity={0.45} strokeWidth={10} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          <RugShape rug={piece} transform={offset(piece.id)} {...look} />
        </g>
      );
    }
    return (
      <g key={piece.id}>
        {halo}
        {piece.kind !== 'carpet' && (
          <polygon points={points(piece)} transform={`translate(2 3) ${offset(piece.id) ?? ''}`} fill="var(--color-desk-shadow)" pointerEvents="none" />
        )}
        <polygon points={points(piece)} transform={offset(piece.id)} {...look} />
      </g>
    );
  };

  const spotRadius = chairSize * 0.6;
  return (
    <g>
      {rugs.map(drawPiece)}
      {chairs.map((seat) => (
        <Chair key={seat.id} seat={seat} size={chairSize} transform={offset(seat.furnitureId)} />
      ))}
      {others.map(drawPiece)}
      {chairs.map((seat) => (
        <Workstation key={`ws-${seat.id}`} seat={seat} size={chairSize} transform={offset(seat.furnitureId)} />
      ))}
      {rugSpots.map((seat) => {
        const picked = spots?.picked === seat.id;
        const move = spots?.moving?.id === seat.id ? spots.moving : null;
        const shift = move ? `translate(${move.dx} ${move.dy})` : offset(seat.furnitureId);
        return (
          <g key={seat.id} transform={shift}>
            {picked && <circle cx={seat.x} cy={seat.y} r={spotRadius * 1.6} fill="var(--color-sage)" fillOpacity={0.3} pointerEvents="none" />}
            <circle
              cx={seat.x}
              cy={seat.y}
              r={spotRadius}
              fill="var(--color-step-seats)"
              stroke="var(--color-stamp-ink)"
              strokeWidth={picked ? 2.5 : 1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {spots && (
              <circle
                cx={seat.x}
                cy={seat.y}
                r={spotRadius * 1.8}
                fill="transparent"
                data-piece={seat.id}
                className="cursor-grab outline-none active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onPointerDown={(event) => spots.onGrab(seat.id, event)}
                tabIndex={0}
                role="button"
                aria-label="Rug seat"
                aria-pressed={picked}
                onKeyDown={(event) => spots.onKey(seat.id, event)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
