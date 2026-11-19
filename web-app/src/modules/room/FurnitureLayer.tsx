import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import type { DocPiece } from '@modules/classroom/document';
import { FURNITURE_CHAIR_SHARE } from '@modules/room/furniture';
import { LETTER_WIDTH } from '@shared/text';
import { pieceOutline, readingAngle } from '@modules/room/roomGeometry';

type Props = {
  furniture: DocPiece[];
  /** The name shown on each piece (numbered when there are two of a kind). */
  nameOf: (piece: DocPiece) => string;
  /** Makes the furniture draggable (the Shape part). */
  onGrab?: (id: string, event: ReactPointerEvent<SVGElement>) => void;
  /** Moves a piece with the arrow keys, to this point. */
  onKeyMove?: (id: string, point: { x: number; y: number }) => void;
  /** R turns a piece a quarter turn. */
  onTurn?: (id: string) => void;
  /** Enter or Space picks a piece up (or puts it down). */
  onPick?: (id: string | null) => void;
  /** The piece picked up: it and what's joined to it are outlined. */
  picked?: string | null;
  /** How big labels are, in room units. */
  labelSize: number;
};

/** The furniture's colors: theme tokens in the app, fixed colors on the chart. An apple stays an apple. */
export type FurnitureColors = { paper: string; paperEdge: string; desk: string; deskEdge: string; rug: string; chair: string; chairEdge: string };

const THEME_COLORS: FurnitureColors = {
  paper: 'var(--color-card)',
  paperEdge: 'var(--color-line)',
  desk: 'var(--color-desk)',
  deskEdge: 'var(--color-desk-edge)',
  rug: 'var(--color-tag-purple)',
  chair: 'var(--color-level-3)',
  chairEdge: 'var(--color-sage)',
};
// Book spines and the sink's water: the same colors on every chart, like the apple.
const BOOKS = ['#f7a294', '#f6d699', '#93c2ae', '#98d9ef', '#b4a7d6'];
const WATER = '#98d9ef';
const APPLE = '#e23b2e';
const APPLE_EDGE = '#a8231a';
const LEAF = '#5f9e3a';
const STEM = '#6b4423';
// The classic apple outline, two units across: two round shoulders with a dip for the stem.
const APPLE_SHAPE = 'M0 -0.55 C-0.35 -0.95 -1.05 -0.75 -1 -0.05 C-0.95 0.65 -0.45 1.05 0 0.85 C0.45 1.05 0.95 0.65 1 -0.05 C1.05 -0.75 0.35 -0.95 0 -0.55 Z';

/**
 * One piece drawn around its middle, before turning: a wooden desk with papers,
 * an apple and the teacher's chair; a rounded wooden table with little chairs
 * around it; a soft rug with a stitched border.
 */
export function FurnitureLook({ kind, w, h, colors = THEME_COLORS }: { kind: string; w: number; h: number; colors?: FurnitureColors }) {
  const PAPER = colors.paper;
  const PAPER_EDGE = colors.paperEdge;
  const EDGE = { stroke: colors.deskEdge, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const };
  const short = Math.min(w, h);
  const chair = short * FURNITURE_CHAIR_SHARE;
  if (kind === 'rug') {
    return (
      <g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={short * 0.18} fill={colors.rug} fillOpacity={0.45} stroke={colors.rug} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <rect x={-w / 2 + short * 0.08} y={-h / 2 + short * 0.08} width={w - short * 0.16} height={h - short * 0.16} rx={short * 0.12} fill="none" stroke={PAPER} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      </g>
    );
  }
  const seat = (x: number, y: number, size = chair) => <rect key={`${x},${y}`} x={x - size / 2} y={y - size / 2} width={size} height={size} rx={size * 0.3} fill={colors.chair} stroke={colors.chairEdge} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
  // No longer offered, but rooms saved with one still draw it.
  if (kind === 'small-group-table') {
    const along = [-w / 4, 0, w / 4];
    return (
      <g>
        {along.map((x) => seat(x, h / 2 + chair * 0.35))}
        {seat(0, -h / 2 - chair * 0.35)}
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={colors.desk} {...EDGE} />
      </g>
    );
  }
  if (kind === 'teacher-chair') return <g>{seat(0, 0, short)}</g>;
  const box = <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={short * 0.12} fill={colors.desk} {...EDGE} />;
  if (kind === 'bookshelf') {
    // Seen from above: a row of book tops along the shelf.
    const count = Math.max(4, Math.round(w / (short * 0.45)));
    const step = (w - short * 0.3) / count;
    return (
      <g>
        {box}
        {Array.from({ length: count }, (_, index) => (
          <rect key={index} x={-w / 2 + short * 0.15 + index * step + step * 0.1} y={-h / 2 + short * 0.18} width={step * 0.8} height={h - short * 0.36} rx={1} fill={BOOKS[index % BOOKS.length]} />
        ))}
      </g>
    );
  }
  if (kind === 'sink') {
    return (
      <g>
        {box}
        <rect x={-w / 2 + short * 0.2} y={-h / 2 + short * 0.2} width={w - short * 0.4} height={h - short * 0.4} rx={short * 0.2} fill={WATER} fillOpacity={0.6} stroke={colors.deskEdge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </g>
    );
  }
  // The teacher's desk: papers and an apple on top (its chair is a piece of its own).
  const paper = { w: short * 0.42, h: short * 0.32 };
  const apple = short * 0.17;
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={short * 0.18} fill={colors.desk} {...EDGE} />
      <rect x={-w / 2 + short * 0.18} y={-h / 2 + short * 0.14} width={paper.w} height={paper.h} rx={2} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} vectorEffect="non-scaling-stroke" transform={`rotate(-8 ${-w / 2 + short * 0.18} ${-h / 2 + short * 0.14})`} />
      <rect x={-w / 2 + short * 0.26} y={-h / 2 + short * 0.2} width={paper.w} height={paper.h} rx={2} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <g transform={`translate(${w / 2 - short * 0.32} ${-h / 2 + short * 0.36}) scale(${apple})`}>
        <path d={APPLE_SHAPE} fill={APPLE} stroke={APPLE_EDGE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <ellipse cx={-0.42} cy={-0.2} rx={0.18} ry={0.3} fill="#ffffff" fillOpacity={0.45} transform="rotate(20 -0.42 -0.2)" />
        <path d="M0 -0.55 Q0.05 -0.85 0.2 -1.05" fill="none" stroke={STEM} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <ellipse cx={0.5} cy={-0.95} rx={0.38} ry={0.16} fill={LEAF} transform="rotate(-25 0.5 -0.95)" />
      </g>
    </g>
  );
}

/**
 * Where a piece's name goes: along its long side at any angle, never upside
 * down, and on the teacher's desk in the free half, away from the papers and apple.
 */
export function furnitureLabel(piece: DocPiece, label: string, labelSize: number): { x: number; y: number; angle: number; fontSize: number } {
  const short = Math.min(piece.w, piece.h);
  const angle = readingAngle({ rotation: piece.rotation + (piece.h > piece.w ? 90 : 0) });
  const radians = (piece.rotation * Math.PI) / 180;
  const down = piece.kind === 'teacher-desk' ? short * 0.22 : 0;
  const fontSize = Math.min(labelSize, short * 0.3, (Math.max(piece.w, piece.h) * 0.85) / Math.max(1, label.length * LETTER_WIDTH));
  return { x: piece.x - down * Math.sin(radians), y: piece.y + down * Math.cos(radians), angle, fontSize };
}

/** The teacher's own furniture, seen from above, each with its name on it. */
export function FurnitureLayer({ furniture, nameOf, onGrab, onKeyMove, onTurn, onPick, picked = null, labelSize }: Props) {
  const pickedPiece = furniture.find((piece) => piece.id === picked);
  const isPicked = (piece: DocPiece) => Boolean(pickedPiece) && (piece.id === pickedPiece!.id || (pickedPiece!.group !== undefined && piece.group === pickedPiece!.group));
  const step = labelSize;
  return (
    <g>
      {/* Chairs first, so a desk is drawn over the part of its chair tucked under it. */}
      {[...furniture].sort((a, b) => Number(b.kind === 'teacher-chair') - Number(a.kind === 'teacher-chair')).map((piece) => {
        const label = nameOf(piece);
        const onKeyDown = (event: ReactKeyboardEvent<SVGElement>) => {
          if ((event.key === 'Enter' || event.key === ' ') && onPick) {
            event.preventDefault();
            onPick(picked === piece.id ? null : piece.id);
            return;
          }
          if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            onTurn?.(piece.id);
            return;
          }
          const by = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!by || !onKeyMove) return;
          event.preventDefault();
          onKeyMove(piece.id, { x: piece.x + by[0] * step, y: piece.y + by[1] * step });
        };
        const grab = onGrab
          ? {
              'data-piece': piece.id,
              className: 'cursor-grab outline-none active:cursor-grabbing',
              style: { touchAction: 'none' as const },
              role: 'button',
              tabIndex: 0,
              'aria-label': `${label}. Tap to pick it up, drag it, or use the arrow keys to move it and R to turn it`,
              'aria-pressed': onPick ? picked === piece.id : undefined,
              onPointerDown: (event: ReactPointerEvent<SVGElement>) => onGrab(piece.id, event),
              onKeyDown,
            }
          : {};
        const points = pieceOutline(piece)
          .map((p) => `${p.x},${p.y}`)
          .join(' ');
        const labelAt = furnitureLabel(piece, label, labelSize);
        return (
          <g key={piece.id} {...grab}>
            <polygon className="focus-ring" points={points} fill="transparent" vectorEffect="non-scaling-stroke" />
            {/* The same soft, rounded halo a picked-up table gets. */}
            {isPicked(piece) && <polygon points={points} fill="none" stroke="var(--color-sage)" strokeOpacity={0.45} strokeWidth={10} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            <g transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rotation})`}>
              <FurnitureLook kind={piece.kind} w={piece.w} h={piece.h} />
            </g>
            {/* The chair is too small for a name; it's in the list beside the drawing. */}
            {piece.kind !== 'teacher-chair' && (
              <text
                x={labelAt.x}
                y={labelAt.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={labelAt.fontSize}
                fontWeight={600}
                fill={piece.kind === 'rug' ? 'var(--color-ink)' : 'var(--color-desk-ink)'}
                transform={labelAt.angle ? `rotate(${labelAt.angle} ${labelAt.x} ${labelAt.y})` : undefined}
                pointerEvents="none"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
