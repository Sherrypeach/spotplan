import type { Furniture, Layout } from '@modules/layouts/types';
import { RugShape } from '@modules/room/RugShape';
import { isShapedRug } from '@modules/room/roomGeometry';
import { furnitureOutline } from '@modules/seating/engine/geometry';

/** A picture of a layout from above: board at the top, wooden desks, a dot for every seat. */
export function LayoutThumb({ layout, className = 'h-20 w-full' }: { layout: Layout; className?: string }) {
  const { width, height } = layout.stage;
  const pad = 0.25;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
      className={`shrink-0 rounded-lg bg-paper ${className}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <rect x={width * 0.3} y={-pad + 0.04} width={width * 0.4} height={0.14} rx={0.07} fill="var(--color-sage-ink)" />
      {layout.furniture.map((piece: Furniture) => {
        const look = {
          fill: piece.kind === 'carpet' ? 'var(--color-tag-purple)' : 'var(--color-desk)',
          fillOpacity: piece.kind === 'carpet' ? 0.5 : 1,
          stroke: piece.kind === 'carpet' ? 'var(--color-field-border)' : 'var(--color-desk-edge)',
          strokeWidth: 0.05,
        };
        return isShapedRug(piece) ? (
          <RugShape key={piece.id} rug={piece} {...look} />
        ) : (
          <polygon
            key={piece.id}
            points={furnitureOutline(piece)
              .map((corner) => `${corner.x},${corner.y}`)
              .join(' ')}
            {...look}
          />
        );
      })}
      {layout.seats.map((seat) => (
        <circle key={seat.id} cx={seat.x} cy={seat.y} r={0.13} fill="var(--color-step-seats)" stroke="var(--color-sage-ink)" strokeWidth={0.04} />
      ))}
    </svg>
  );
}
