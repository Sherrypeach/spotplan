import { useId, type Ref } from 'react';

import { CHART_PALETTES } from '@modules/chart/chartStyles';
import { LINE_HEIGHT } from '@modules/chart/sheetNames';
import { BADGE_RADIUS, BOARD, CARD, FOOTER, HEADER, layoutSheet, LIST, MARGIN, SPOT_SHARE, STEPS, type SheetLayout, type SheetVariant } from '@modules/chart/sheetLayout';
import type { ClassroomDocument, DocPiece } from '@modules/classroom/document';
import { furnitureName, isFurniture } from '@modules/room/furniture';
import { FurnitureLook, furnitureLabel } from '@modules/room/FurnitureLayer';
import { floorOutline, isShapedRug, pieceOutline, type Point } from '@modules/room/roomGeometry';
import { deskUnit } from '@modules/room/roomGroups';
import { RugShape } from '@modules/room/RugShape';
import { UNITS_PER_FOOT } from '@modules/room/units';
import { WallFeaturesLayer } from '@modules/room/WallFeaturesLayer';
import { count, textWidth } from '@shared/text';

const FONT = 'Poppins, Arial, sans-serif';

// Room-drawing sizes, in sheet units: they're divided by the drawing's scale to stay the same on any room.
const DESK_STROKE = 2;
const CHAIR_STROKE = 1.5;
const LABEL_FONT = 14;
const ROOM_CORNER_FEET = 1.5;
const FLOOR_DOT_FEET = 2;
const FLOOR_DOT_SHARE = 0.06;
// A rug the class sits on lets the floor show through, as in the room drawing.
const RUG_OPACITY = 0.6;
// Sheet units: sticker and card edges, the board's text spacing.
const TAG_STROKE = 1.5;
const CARD_STROKE = 1.5;
const BOARD_LETTER_SPACING = 2;
// A name sticker's padding and color dot, as shares of the font size (sheetNames.ts sizes the sticker the same way).
const TAG_PADDING = 0.45;
const DOT_ROOM = 0.9;
const DOT_SIZE = 0.3;
// Words on a shelf or supply desk, when it has no label of its own.
const SIDE_LABEL = 'Supplies';

type Props = {
  doc: ClassroomDocument;
  ref?: Ref<SVGSVGElement>;
  /** The full sheet, or the room alone to fill a screen when presenting. */
  variant?: SheetVariant;
  /** Fit the whole sheet in its box (presenting), instead of filling the width. */
  fit?: boolean;
  /** The id of a text list of who sits where, for screen readers. */
  describedBy?: string;
  /** Where everything goes, when the page already worked it out. */
  layout?: SheetLayout;
};

function polygon(outline: Point[]): string {
  return outline.map((corner) => `${corner.x},${corner.y}`).join(' ');
}

/** A closed outline with every corner rounded by up to `radius`. */
function roundedPath(points: [number, number][], radius: number): string {
  const n = points.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n];
    const [x, y] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const toPrev = Math.hypot(px - x, py - y);
    const toNext = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, toPrev / 2, toNext / 2);
    const start = [x + ((px - x) / toPrev) * r, y + ((py - y) / toPrev) * r];
    const end = [x + ((nx - x) / toNext) * r, y + ((ny - y) / toNext) * r];
    parts.push(`${i === 0 ? 'M' : 'L'} ${start[0]} ${start[1]} Q ${x} ${y} ${end[0]} ${end[1]}`);
  }
  return `${parts.join(' ')} Z`;
}

function isSide(piece: DocPiece): boolean {
  return piece.kind === 'storage' || piece.kind === 'supply-desk';
}

/**
 * The clean seating chart as one picture: a header, the room with every
 * student's full name beside or on their desk, and a column for moving-day
 * directions and who sits at each table. Names only — never levels, needs,
 * notes or seat labels.
 */
export function ChartSheet({ doc, ref, variant = 'sheet', fit = false, describedBy, layout: given }: Props) {
  const { chart } = doc;
  const colors = CHART_PALETTES[chart.style];
  const layout = given ?? layoutSheet(doc, variant);
  const { room, drawing, header } = layout;
  const { scale, area } = drawing;
  const dotsId = `dots${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const dotStep = UNITS_PER_FOOT * FLOOR_DOT_FEET;
  const tableColor = (piece: DocPiece) => {
    if (isSide(piece)) return colors.SIDE;
    const index = layout.tables.indexOf(layout.tableOf(piece));
    return colors.TABLE_COLORS && index >= 0 ? colors.TABLE_COLORS[index % colors.TABLE_COLORS.length] : colors.DESK;
  };
  const furnitureColors = { paper: colors.TAG, paperEdge: colors.TAG_EDGE, desk: colors.DESK, deskEdge: colors.DESK_EDGE, rug: colors.RUG, chair: colors.CHAIR, chairEdge: colors.CHAIR_EDGE };
  const rugs = layout.furniture.filter((piece) => piece.kind === 'rug');
  const otherFurniture = layout.furniture.filter((piece) => piece.kind !== 'rug');
  const carpets = layout.desks.filter((piece) => piece.kind === 'carpet');
  const desks = layout.desks.filter((piece) => piece.kind !== 'carpet');
  const spotRadius = deskUnit(room) * SPOT_SHARE;
  const floorFill = colors.FLOOR_DOTS ? `url(#${dotsId})` : colors.FLOOR;
  const seatedCount = layout.tags.length;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={`${chart.title || 'Seating chart'}: ${count(seatedCount, 'teammate')}`}
      aria-describedby={describedBy}
      fontFamily={FONT}
      className={fit ? 'h-full max-h-full w-auto max-w-full' : 'h-auto w-full'}
    >
      <rect width={layout.width} height={layout.height} fill={colors.PAPER} />

      {/* The header: a little bar, the title and subtitle, and the date. Presenting leaves it off. */}
      {variant === 'sheet' && (
        <>
          <rect x={MARGIN} y={header.pillY} width={HEADER.pillWidth} height={HEADER.pillHeight} rx={HEADER.pillHeight / 2} fill={colors.ACCENT} />
          {header.title && (
            <text x={MARGIN} y={header.titleY} fontSize={header.titleFont} fontWeight={600} fill={colors.TITLE}>
              {header.title}
            </text>
          )}
          {header.subtitle && (
            <text x={MARGIN} y={header.subtitleY} fontSize={HEADER.subtitleFont} fill={colors.MUTED}>
              {header.subtitle}
            </text>
          )}
          <g transform={`translate(${layout.width - MARGIN - header.chipWidth} ${header.chipY})`}>
            <rect width={header.chipWidth} height={HEADER.chipHeight} rx={HEADER.chipHeight / 2} fill={colors.CHIP} stroke={colors.CARD_EDGE} strokeWidth={CARD_STROKE} />
            <text x={header.chipWidth / 2} y={HEADER.chipHeight / 2} textAnchor="middle" dominantBaseline="central" fontSize={HEADER.chipFont} fontWeight={600} fill={colors.CHIP_INK}>
              {header.date}
            </text>
          </g>
        </>
      )}

      {/* The room, in its own units. */}
      <svg x={drawing.x} y={drawing.y} width={drawing.width} height={drawing.height} viewBox={`${area.left} ${area.top} ${area.right - area.left} ${area.bottom - area.top}`}>
        <defs>
          <pattern id={dotsId} width={dotStep} height={dotStep} patternUnits="userSpaceOnUse">
            <rect width={dotStep} height={dotStep} fill={colors.FLOOR} />
            {colors.FLOOR_DOTS && <circle cx={dotStep / 2} cy={dotStep / 2} r={dotStep * FLOOR_DOT_SHARE} fill={colors.FLOOR_DOTS} />}
          </pattern>
        </defs>
        <path
          d={roundedPath(floorOutline(room), colors.ROUND_ROOM ? UNITS_PER_FOOT * ROOM_CORNER_FEET : 0)}
          fill={floorFill}
          stroke={colors.WALL}
          strokeWidth={colors.WALL_WIDTH / scale}
          strokeLinejoin="round"
        />
        {rugs.map((piece) => (
          <g key={piece.id} transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rotation})`}>
            <FurnitureLook kind={piece.kind} w={piece.w} h={piece.h} colors={furnitureColors} />
          </g>
        ))}
        {carpets.map((piece) =>
          isShapedRug(piece) ? (
            <RugShape key={piece.id} rug={piece} fill={colors.RUG} fillOpacity={RUG_OPACITY} stroke={colors.RUG_EDGE} strokeWidth={DESK_STROKE / scale} />
          ) : (
            <polygon
              key={piece.id}
              points={polygon(pieceOutline(piece))}
              fill={colors.RUG}
              fillOpacity={RUG_OPACITY}
              stroke={colors.RUG_EDGE}
              strokeWidth={DESK_STROKE / scale}
              strokeLinejoin="round"
            />
          ),
        )}
        <defs>
          <clipPath id={`${dotsId}-walls`}>
            <rect
              x={-colors.WALL_WIDTH / 2 / scale}
              y={-colors.WALL_WIDTH / 2 / scale}
              width={room.width + colors.WALL_WIDTH / scale}
              height={room.depth + colors.WALL_WIDTH / scale}
            />
          </clipPath>
        </defs>
        {/* A door's gap cuts the wall, never the paper outside it. */}
        <g clipPath={`url(#${dotsId}-walls)`}>
          <WallFeaturesLayer
            features={layout.features}
            labelSize={LABEL_FONT / scale}
            colors={{ floor: colors.FLOOR, door: colors.DOOR, window: colors.WINDOW, windowEdge: colors.WINDOW_EDGE, label: colors.MUTED }}
          />
        </g>
        {otherFurniture.map((piece) => {
          const name = furnitureName(room, piece);
          const label = furnitureLabel(piece, name, LABEL_FONT / scale);
          return (
            <g key={piece.id}>
              {/* The same desk, chair and table as in the room drawing, in this style's colors. */}
              <g transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rotation})`}>
                <FurnitureLook kind={piece.kind} w={piece.w} h={piece.h} colors={furnitureColors} />
              </g>
              {isFurniture(piece) && piece.kind !== 'teacher-chair' && (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={label.fontSize}
                  fontWeight={600}
                  fill={colors.DESK_INK}
                  transform={label.angle ? `rotate(${label.angle} ${label.x} ${label.y})` : undefined}
                >
                  {name}
                </text>
              )}
            </g>
          );
        })}
        {/* A chair for every seat at a desk or table, tucked under its edge, its back away from the desk. */}
        {layout.chairs.map((seat) => {
          const size = layout.chairSize;
          return (
            <g key={seat.id} transform={`translate(${seat.x} ${seat.y}) rotate(${seat.facing})`}>
              <circle r={size * 0.42} fill={colors.CHAIR} stroke={colors.CHAIR_EDGE} strokeWidth={CHAIR_STROKE / scale} />
              {colors.CHAIR_BACK && (
                <path d={`M ${-size * 0.48} ${size * 0.22} Q 0 ${size * 0.72} ${size * 0.48} ${size * 0.22}`} fill="none" stroke={colors.CHAIR_BACK} strokeWidth={size * 0.2} strokeLinecap="round" />
              )}
            </g>
          );
        })}
        {desks.map((piece) => {
          const side = isSide(piece);
          const words = piece.label || SIDE_LABEL;
          return (
            <g key={piece.id}>
              <polygon
                points={polygon(pieceOutline(piece))}
                fill={tableColor(piece)}
                stroke={side ? colors.SIDE_EDGE : colors.DESK_EDGE}
                strokeWidth={DESK_STROKE / scale}
                strokeLinejoin="round"
              />
              {/* Shelves and supply desks say what they are, so they don't look like an empty desk. */}
              {side && (
                <text
                  x={piece.x}
                  y={piece.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(LABEL_FONT / scale, (Math.max(piece.w, piece.h) * 0.85) / Math.max(1, textWidth(words, 1)), Math.min(piece.w, piece.h) * 0.5)}
                  fontWeight={600}
                  fill={colors.MUTED}
                  transform={piece.h > piece.w ? `rotate(-90 ${piece.x} ${piece.y})` : undefined}
                >
                  {words}
                </text>
              )}
            </g>
          );
        })}
        {layout.spots.map((seat) => (
          <circle key={seat.id} cx={seat.x} cy={seat.y} r={spotRadius} fill={colors.CHAIR} stroke={colors.CHAIR_EDGE} strokeWidth={CHAIR_STROKE / scale} />
        ))}
      </svg>

      {/* The chalkboard on the front wall, in a wooden frame. */}
      <rect
        x={layout.board.x - layout.board.width / 2}
        y={layout.board.y - layout.board.height / 2}
        width={layout.board.width}
        height={layout.board.height}
        rx={4}
        fill={colors.BOARD}
        stroke={colors.BOARD_FRAME}
        strokeWidth={BOARD.frame}
      />
      <text x={layout.board.x} y={layout.board.y} textAnchor="middle" dominantBaseline="central" fontSize={BOARD.font} fontWeight={600} letterSpacing={BOARD_LETTER_SPACING} fill={colors.BOARD_TEXT}>
        {BOARD.label}
      </text>

      {layout.badges.map((badge) => (
        <g key={badge.number}>
          <circle cx={badge.x} cy={badge.y} r={BADGE_RADIUS} fill={colors.BOARD} stroke={colors.TAG} strokeWidth={2} />
          <text x={badge.x} y={badge.y} textAnchor="middle" dominantBaseline="central" fontSize={BADGE_RADIUS} fontWeight={600} fill={colors.BOARD_TEXT}>
            {badge.number}
          </text>
        </g>
      ))}

      {/* Every name in full, one size, on a sticker. */}
      {layout.tags.map((tag) => {
        const font = layout.font;
        const color = tag.color !== null ? colors.TAG_COLORS[tag.color] : null;
        const left = tag.x - tag.width / 2 + font * TAG_PADDING;
        const dot = color ? font * DOT_ROOM : 0;
        const textMiddle = left + dot + (tag.width - font * TAG_PADDING * 2 - dot) / 2;
        return (
          <g key={tag.id} transform={tag.angle ? `rotate(${tag.angle} ${tag.x} ${tag.y})` : undefined}>
            <rect
              x={tag.x - tag.width / 2}
              y={tag.y - tag.height / 2}
              width={tag.width}
              height={tag.height}
              rx={tag.height / 2}
              fill={colors.TAG}
              stroke={colors.TAG_EDGE}
              strokeWidth={TAG_STROKE}
            />
            {color && <circle cx={left + dot / 2} cy={tag.y} r={font * DOT_SIZE} fill={color} />}
            {tag.lines.map((line, index) => (
              <text
                key={index}
                x={textMiddle}
                y={tag.y + (index - (tag.lines.length - 1) / 2) * font * LINE_HEIGHT}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={font}
                fontWeight={600}
                fill={colors.INK}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      {layout.directions && (
        <g>
          <SideCardBox card={layout.directions.card} fill={colors.CARD} edge={colors.CARD_EDGE} title={colors.TITLE} />
          {layout.directions.rows.map((row) => (
            <g key={row.number}>
              <circle
                cx={row.x + STEPS.stamp / 2}
                cy={row.y + STEPS.stamp / 2}
                r={STEPS.stamp / 2}
                fill={colors.STAMPS[(row.number - 1) % colors.STAMPS.length]}
                stroke={colors.STAMP_EDGE}
                strokeWidth={CARD_STROKE}
              />
              <text x={row.x + STEPS.stamp / 2} y={row.y + STEPS.stamp / 2} textAnchor="middle" dominantBaseline="central" fontSize={STEPS.font} fontWeight={600} fill={colors.STAMP_INK}>
                {row.number}
              </text>
              {row.lines.map((line, index) => (
                <text key={index} x={line.x} y={line.y} fontSize={STEPS.font} fill={colors.INK}>
                  {line.text}
                </text>
              ))}
            </g>
          ))}
        </g>
      )}

      {layout.list && (
        <g>
          <SideCardBox card={layout.list.card} fill={colors.CARD} edge={colors.CARD_EDGE} title={colors.TITLE} />
          {layout.list.blocks.map((block) => (
            <g key={block.number}>
              <circle cx={block.x + BADGE_RADIUS} cy={block.y + BADGE_RADIUS} r={BADGE_RADIUS} fill={colors.BOARD} />
              <text x={block.x + BADGE_RADIUS} y={block.y + BADGE_RADIUS} textAnchor="middle" dominantBaseline="central" fontSize={BADGE_RADIUS} fontWeight={600} fill={colors.BOARD_TEXT}>
                {block.number}
              </text>
              {block.names.map((line, index) => (
                <g key={index}>
                  <text x={line.x} y={line.y} fontSize={LIST.font} fill={colors.INK}>
                    {line.text}
                  </text>
                  {chart.showColors && line.color !== null && (
                    <circle cx={line.x + textWidth(line.text, LIST.font) + LIST.font * 0.6} cy={line.y - LIST.font * 0.35} r={LIST.font * DOT_SIZE} fill={colors.TAG_COLORS[line.color]} />
                  )}
                </g>
              ))}
            </g>
          ))}
        </g>
      )}

      {layout.footerY !== null && (
        <text x={layout.width / 2} y={layout.footerY} textAnchor="middle" fontSize={FOOTER.font} fill={colors.FOOTER}>
          {FOOTER.text}
        </text>
      )}
    </svg>
  );
}

/** A card in the column beside the room, with its title. */
function SideCardBox({ card, fill, edge, title }: { card: { x: number; y: number; width: number; height: number; title: string }; fill: string; edge: string; title: string }) {
  return (
    <>
      <rect x={card.x} y={card.y} width={card.width} height={card.height} rx={CARD.radius} fill={fill} stroke={edge} strokeWidth={CARD_STROKE} />
      <text x={card.x + CARD.padding} y={card.y + CARD.padding + CARD.titleFont * 0.8} fontSize={CARD.titleFont} fontWeight={600} fill={title}>
        {card.title}
      </text>
    </>
  );
}
