import { IconSchool } from '@tabler/icons-react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { DocSpot } from '@modules/classroom/document';
import { DEFAULT_SETTINGS } from '@modules/seating/engine';
import { TOUCH_RADIUS_PX, useDrawingScale } from '@modules/room/drawingScale';

type Props = {
  spots: DocSpot[];
  /** A desk's width in room units: the zones are measured in desks. */
  unit: number;
  /** The floor's outline, so the zones stay inside the room. */
  clipId: string;
  selected: string | null;
  onGrab: (id: string, event: ReactPointerEvent<SVGElement>) => void;
  /** How the spots move from the keyboard: arrows nudge, Enter selects. */
  onKey: (id: string, event: React.KeyboardEvent<SVGElement>) => void;
};

const { greenDesks, yellowDesks } = DEFAULT_SETTINGS.closeness;

// How strongly each spot's zones show: where the teacher spends most of the day counts most.
const ZONE_OPACITY: Record<DocSpot['time'], number> = { most: 1, sometimes: 0.55, 'not-much': 0 };

/**
 * Where the teacher spends time, as markers with soft green and yellow rings:
 * kids in the green stay on task, in the yellow only while the teacher faces them.
 */
export function TeacherSpotsLayer({ spots, unit, clipId, selected, onGrab, onKey }: Props) {
  const marker = unit * 0.32;
  const markers = spots.filter((spot) => !spot.pieceId);
  const pxPerUnit = useDrawingScale();
  const reach = Math.max(marker * 1.5, TOUCH_RADIUS_PX / pxPerUnit);
  return (
    <g>
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        {spots.map((spot) => (
          <g key={spot.id} opacity={ZONE_OPACITY[spot.time]}>
            <circle cx={spot.x} cy={spot.y} r={unit * yellowDesks} fill="var(--color-level-2)" fillOpacity={0.18} />
            <circle cx={spot.x} cy={spot.y} r={unit * greenDesks} fill="var(--color-level-3)" fillOpacity={0.3} />
          </g>
        ))}
      </g>
      {/* Places on furniture move with it; only the free markers are dragged. */}
      {markers.map((spot, index) => (
        <g
          key={spot.id}
          role="button"
          tabIndex={0}
          aria-label={`Where I work${markers.length > 1 ? ` ${index + 1}` : ''}. Drag or use the arrow keys to move it`}
          aria-pressed={selected === spot.id}
          data-piece={spot.id}
          className="cursor-grab outline-none active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={(event) => onGrab(spot.id, event)}
          onKeyDown={(event) => onKey(spot.id, event)}
        >
          <circle cx={spot.x} cy={spot.y} r={reach} fill="transparent" />
          <circle className="focus-ring" cx={spot.x} cy={spot.y} r={marker * 1.5} fill="none" vectorEffect="non-scaling-stroke" />
          {selected === spot.id && <circle cx={spot.x} cy={spot.y} r={marker * 1.5} fill="none" stroke="var(--color-sage)" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
          <circle cx={spot.x} cy={spot.y} r={marker} fill="var(--color-sage-ink)" stroke="var(--color-card)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <IconSchool x={spot.x - marker * 0.6} y={spot.y - marker * 0.6} width={marker * 1.2} height={marker * 1.2} color="var(--color-card)" pointerEvents="none" />
          {markers.length > 1 && (
            <text x={spot.x} y={spot.y + marker * 1.9} textAnchor="middle" fontSize={marker * 0.75} fontWeight={600} fill="var(--color-sage-ink)" pointerEvents="none">
              {index + 1}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
