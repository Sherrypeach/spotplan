import { sheetSeats, sheetTables, shownDirections, type SheetSeat } from '@modules/chart/chartModel';
import { fontSizes, placeNames, type NameSeat, type NameTag, type Obstacle } from '@modules/chart/sheetNames';
import type { ClassroomDocument, DocPiece, DocRoom, DocSeat } from '@modules/classroom/document';
import { boardLength, frontOf, toFrontUp } from '@modules/room/frontFrame';
import { frontWall, pieceBox, readingAngle, type Box, type Point } from '@modules/room/roomGeometry';
import { boundsOf, deskUnit, isLayoutPiece, pieceGroups } from '@modules/room/roomGroups';
import { UNITS_PER_FOOT } from '@modules/room/units';
import { isWallFeature, wallFeatures } from '@modules/room/wallFeatures';
import { namePlaces } from '@modules/seats/seatNames';
import { textWidth } from '@shared/text';

/**
 * Where everything on the seating chart goes, worked out before drawing:
 * a landscape sheet with a header, the room on the left (its board always
 * at the top), and a column beside it for moving-day directions and a list
 * of who sits at each table. "room" is the room alone, filling a 16:9
 * screen, for presenting. All numbers are sheet units unless they say
 * "room units".
 */

export const SHEET_WIDTH = 1600;
// The presented room fills a widescreen display, with only a thin edge and no header.
const PRESENT_HEIGHT = 900;
const PRESENT_MARGIN = 24;
export const MARGIN = 48;
const GAP = 32;
const SIDE_WIDTH = 416;
// A very deep room is drawn no taller than this, so the page stays printable.
const MAX_ROOM_HEIGHT = 1150;

export const HEADER = { pillWidth: 120, pillHeight: 10, titleFont: 40, presentTitleFont: 32, subtitleFont: 20, chipFont: 17, chipHeight: 36, gap: 28 };
// Space between the bar and the title, and between the title and the subtitle.
const PILL_GAP = 18;
const SUBTITLE_GAP = 10;
export const FOOTER = { font: 14, room: 56, text: 'Made with SpotPlan' };

// One name size for the whole sheet: the biggest from this range that fits every name.
const SHEET_NAME_FONTS = fontSizes(22, 16);
const PRESENT_NAME_FONTS = fontSizes(34, 20);
// Tried only in a crowded room where no size above leaves every name a free spot.
const CROWDED_NAME_FONTS = fontSizes(15, 13);
const CROWDED_PRESENT_FONTS = fontSizes(19, 16);

export const BOARD = { maxWidth: 360, height: 28, frame: 4, font: 15, label: 'FRONT' };
// The board's gap to the wall it hangs on, and the room names keep from it.
const BOARD_INSET = 10;
const BOARD_CLEARANCE = 6;

export const CARD = { padding: 24, radius: 18, titleFont: 24, titleGap: 18, gap: 24 };
export const STEPS = { font: 19, lineHeight: 1.4, stamp: 34, stampGap: 14, rowGap: 14, title: 'Moving day' };
export const LIST = { font: 17, line: 25, columns: 2, columnGap: 18, blockGap: 16, title: 'Who sits where' };
export const BADGE_RADIUS = 15;
// Under the room the steps sit side by side in up to this many columns, the list in this many.
const UNDER_STEP_COLUMNS = 3;
const UNDER_LIST_COLUMNS = 4;
// A letter page with 10mm margins, in inches, either way up: to compare how big names print.
export const PRINT_PAGE = { long: 10.21, short: 7.71 };

// Floor shown around the whole room, in feet.
const ROOM_PAD_FEET = 1;
// A chair's size next to its desk, as a share of a desk.
export const CHAIR_SHARE = 0.34;
// A spot on a rug, as a share of a desk.
export const SPOT_SHARE = 0.12;
// Names on a desk use at most this share of it.
const DESK_FILL = 0.92;

export type SheetVariant = 'sheet' | 'room';

export type TextLine = { text: string; x: number; y: number };
export type StepRow = { number: number; x: number; y: number; lines: TextLine[] };
export type TableBlock = { number: number; x: number; y: number; names: (TextLine & { color: number | null })[] };
export type SideCard = { x: number; y: number; width: number; height: number; title: string };


export type SheetLayout = {
  width: number;
  height: number;
  header: { title: string; titleFont: number; titleY: number; subtitle: string; subtitleY: number; pillY: number; date: string; chipWidth: number; chipY: number };
  footerY: number | null;
  /** The room turned so its board is at the top. */
  room: DocRoom;
  /** The drawing, in room units, and where it lands on the sheet. */
  drawing: { area: Box; x: number; y: number; width: number; height: number; scale: number };
  board: { x: number; y: number; width: number; height: number };
  desks: DocPiece[];
  /** The table each desk belongs to, for one color per table. */
  tableOf: (piece: DocPiece) => string;
  tables: string[];
  furniture: DocPiece[];
  features: DocPiece[];
  chairs: DocSeat[];
  /** Seats on a rug: a dot on the rug, the name beside it. */
  spots: DocSeat[];
  chairSize: number;
  font: number;
  tags: NameTag[];
  badges: { number: number; x: number; y: number }[];
  directions: { card: SideCard; rows: StepRow[] } | null;
  list: { card: SideCard; blocks: TableBlock[] } | null;
};

/** Text broken into lines no wider than `width`; a word too long for a line is split. */
export function wrapText(text: string, width: number, font: number): string[] {
  const lines: string[] = [];
  let line = '';
  const pieces = text.split(/\s+/).filter(Boolean).flatMap((word) => {
    if (textWidth(word, font) <= width) return [word];
    const parts: string[] = [];
    let part = '';
    for (const character of word) {
      if (part && textWidth(part + character, font) > width) {
        parts.push(part);
        part = '';
      }
      part += character;
    }
    return [...parts, part];
  });
  for (const word of pieces) {
    const longer = line ? `${line} ${word}` : word;
    if (line && textWidth(longer, font) > width) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  if (line) lines.push(line);
  return lines;
}

function middleOf(box: Box): Point {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

function grow(box: Box, by: number): Box {
  return { left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by };
}

function chartDate(at: Date): string {
  return at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * The moving-day steps on a card: a numbered circle, then the step's words.
 * Beside the room the steps run down one column; under it, side by side.
 */
function layoutDirections(steps: string[], x: number, y: number, width: number, columns: number): { card: SideCard; rows: StepRow[] } {
  const columnWidth = (width - CARD.padding * 2 - CARD.gap * (columns - 1)) / columns;
  const textRoom = columnWidth - STEPS.stamp - STEPS.stampGap;
  const lineHeight = STEPS.font * STEPS.lineHeight;
  let top = y + CARD.padding + CARD.titleFont + CARD.titleGap;
  const rows: StepRow[] = [];
  for (let first = 0; first < steps.length; first += columns) {
    const line = steps.slice(first, first + columns).map((step) => wrapText(step, textRoom, STEPS.font));
    line.forEach((wrapped, column) => {
      const left = x + CARD.padding + column * (columnWidth + CARD.gap);
      // The first line lines up with the middle of its number.
      const firstLine = top + STEPS.stamp / 2 + STEPS.font * 0.35;
      rows.push({ number: first + column + 1, x: left, y: top, lines: wrapped.map((text, index) => ({ text, x: left + STEPS.stamp + STEPS.stampGap, y: firstLine + index * lineHeight })) });
    });
    top += Math.max(STEPS.stamp, ...line.map((wrapped) => wrapped.length * lineHeight)) + STEPS.rowGap;
  }
  const height = top - STEPS.rowGap + CARD.padding - y;
  return { card: { x, y, width, height, title: STEPS.title }, rows };
}

/** Each table's students, A to Z, in columns of blocks that fill the shortest column first. */
function layoutList(doc: ClassroomDocument, x: number, y: number, width: number, most: number): { card: SideCard; blocks: TableBlock[] } {
  const tables = sheetTables(doc);
  const nameLeft = BADGE_RADIUS * 2 + 10;
  const widestName = Math.max(0, ...tables.flatMap((table) => table.seats.map((seat) => textWidth(seat.name, LIST.font))));
  const widthOf = (count: number) => (width - CARD.padding * 2 - LIST.columnGap * (count - 1)) / count;
  // As many columns as leave every name on one line, at least one.
  let columns = most;
  while (columns > 1 && widthOf(columns) - nameLeft - LIST.font < widestName) columns -= 1;
  const columnWidth = widthOf(columns);
  const top = y + CARD.padding + CARD.titleFont + CARD.titleGap;
  const heights = Array<number>(columns).fill(0);
  const blocks = tables.map((table) => {
    const column = heights.indexOf(Math.min(...heights));
    const left = x + CARD.padding + column * (columnWidth + LIST.columnGap);
    const blockTop = top + heights[column];
    const sorted = [...table.seats].sort((a, b) => a.name.localeCompare(b.name));
    const names: TableBlock['names'] = [];
    for (const seat of sorted) {
      wrapText(seat.name, columnWidth - nameLeft - LIST.font, LIST.font).forEach((text, index) => {
        // A name's color dot goes after its first line.
        names.push({ text, x: left + nameLeft, y: blockTop + names.length * LIST.line + LIST.line * 0.7, color: index === 0 ? seat.color : null });
      });
    }
    heights[column] += Math.max(BADGE_RADIUS * 2, names.length * LIST.line) + LIST.blockGap;
    return { number: table.number, x: left, y: blockTop, names };
  });
  const height = top - y + Math.max(0, ...heights) - LIST.blockGap + CARD.padding;
  return { card: { x, y, width, height, title: LIST.title }, blocks };
}

export function layoutSheet(original: ClassroomDocument, variant: SheetVariant = 'sheet', today = new Date()): SheetLayout {
  const room = toFrontUp(original.room);
  const doc: ClassroomDocument = { ...original, room };
  const { chart } = doc;
  const present = variant === 'room';
  const foot = UNITS_PER_FOOT;

  // The header: a little bar, the title and subtitle on the left, the date on the right.
  const date = chartDate(today);
  const chipWidth = textWidth(date, HEADER.chipFont) + HEADER.chipHeight;
  const titleRoom = SHEET_WIDTH - MARGIN * 2 - chipWidth - GAP;
  const titleFont = Math.min(present ? HEADER.presentTitleFont : HEADER.titleFont, chart.title ? titleRoom / (textWidth(chart.title, 1) || 1) : Infinity);
  const subtitleFont = Math.min(HEADER.subtitleFont, chart.subtitle ? titleRoom / (textWidth(chart.subtitle, 1) || 1) : Infinity);
  const pillY = MARGIN;
  const titleTop = pillY + HEADER.pillHeight + PILL_GAP;
  const titleY = titleTop + titleFont * 0.8;
  const titleBottom = titleTop + (chart.title ? titleFont : HEADER.chipHeight);
  const subtitleY = titleBottom + SUBTITLE_GAP + subtitleFont * 0.8;
  const headerBottom = present ? PRESENT_MARGIN : (chart.subtitle ? titleBottom + SUBTITLE_GAP + subtitleFont : titleBottom) + HEADER.gap;

  // What's on the map.
  const desks = room.pieces.filter((piece) => isLayoutPiece(piece.id));
  const furniture = room.pieces
    .filter((piece) => !isLayoutPiece(piece.id) && !isWallFeature(piece) && (piece.kind === 'rug' ? chart.showRug : chart.showFurniture))
    // Chairs first, so a desk is drawn over the part of its chair tucked under it.
    .sort((a, b) => Number(b.kind === 'teacher-chair') - Number(a.kind === 'teacher-chair'));
  const shownFeatures = wallFeatures(room).filter((piece) => (piece.kind === 'window' ? chart.showWindows : chart.showDoors));
  const seats = sheetSeats(doc);
  // Presenting shows just the seats, as big as the screen allows.


  // The drawing's area, in room units: the whole room, always, so every desk is where it really is.
  const pad = foot * ROOM_PAD_FEET;
  const area: Box = { left: -pad, top: -pad, right: room.width + pad, bottom: room.depth + pad };
  const areaWidth = area.right - area.left;
  const areaHeight = area.bottom - area.top;

  // The room on the left, the column beside it when there's anything to put in it.
  const steps = !present && chart.showDirections ? shownDirections(chart) : [];
  const hasList = !present && chart.showList && seats.length > 0;
  const hasSide = steps.length > 0 || hasList;
  const arrange = (below: boolean): SheetLayout => {
    const edge = present ? PRESENT_MARGIN : MARGIN;
    const columnWidth = SHEET_WIDTH - edge * 2 - (hasSide && !below ? SIDE_WIDTH + GAP : 0);
    const roomTop = headerBottom;
    const heightRoom = present ? PRESENT_HEIGHT - roomTop - PRESENT_MARGIN : MAX_ROOM_HEIGHT;
    const scale = Math.min(columnWidth / areaWidth, heightRoom / areaHeight);
    const drawing = {
      area,
      scale,
      width: areaWidth * scale,
      height: areaHeight * scale,
      x: edge + (columnWidth - areaWidth * scale) / 2,
      y: present ? roomTop + (heightRoom - areaHeight * scale) / 2 : roomTop,
    };
    const toSheet = (point: Point): Point => ({ x: drawing.x + (point.x - area.left) * scale, y: drawing.y + (point.y - area.top) * scale });
    const boxToSheet = (box: Box): Box => {
      const a = toSheet({ x: box.left, y: box.top });
      const b = toSheet({ x: box.right, y: box.bottom });
      return { left: a.x, top: a.y, right: b.x, bottom: b.y };
    };

    const floor = boxToSheet({ left: 0, top: 0, right: room.width, bottom: room.depth });

    // The board, centered on the front wall, never longer than the editor draws it.
    const [wallFrom, wallTo] = frontWall(room);
    const boardWidth = Math.min(BOARD.maxWidth, boardLength(room) * scale);
    const boardMiddle = toSheet({ x: (wallFrom + wallTo) / 2, y: 0 }).x;
    const [topEdge, leftEdge, rightEdge] = [floor.top, floor.left, floor.right];
    const board = {
      x: Math.min(Math.max(boardMiddle, leftEdge + boardWidth / 2 + BOARD_INSET), rightEdge - boardWidth / 2 - BOARD_INSET),
      y: topEdge + BOARD_INSET + BOARD.height / 2,
      width: boardWidth,
      height: BOARD.height,
    };

    // Tables: desks pushed together share one key; the colorful style gives each its own color.
    const groups = pieceGroups(room);
    const tableOf = (piece: DocPiece) => groups.get(piece.id)?.[0] ?? piece.id;
    const seatedPieces = new Set(room.seats.map((seat) => seat.furnitureId));
    const tables = [...new Set(desks.filter((piece) => seatedPieces.has(piece.id)).map(tableOf))];
    const pieceById = new Map(room.pieces.map((piece) => [piece.id, piece]));
    const chairSize = deskUnit(room) * CHAIR_SHARE;
    const onRug = (seat: { furnitureId: string }) => pieceById.get(seat.furnitureId)?.kind === 'carpet';
    const chairs = room.seats.filter((seat) => pieceById.has(seat.furnitureId) && !onRug(seat));
    const seated = new Set(seats.map((seat) => seat.id));
    const spots = room.seats.filter((seat) => onRug(seat) && seated.has(seat.id));

    // Table numbers, with the list: on the desk nearest each table's middle.
    const badges = hasList
      ? sheetTables(doc).map((table) => {
          const nearest = desks.reduce<DocPiece | null>((best, piece) => (!best || Math.hypot(piece.x - table.x, piece.y - table.y) < Math.hypot(best.x - table.x, best.y - table.y) ? piece : best), null);
          return { number: table.number, ...toSheet(nearest ?? table) };
        })
      : [];

    // What names keep off.
    const obstacles: Obstacle[] = [
      { box: grow({ left: board.x - board.width / 2, right: board.x + board.width / 2, top: board.y - board.height / 2, bottom: board.y + board.height / 2 }, BOARD.frame + BOARD_CLEARANCE) },
      // A rug isn't in the way: the class sits on it.
      ...desks.filter((piece) => piece.kind !== 'carpet').map((piece) => ({ box: boxToSheet(pieceBox(piece)), table: tableOf(piece) })),
      ...furniture.filter((piece) => piece.kind !== 'rug').map((piece) => ({ box: boxToSheet(pieceBox(piece)) })),
      // A door keeps clear the floor it swings over; a window, its label.
      ...shownFeatures.map((piece) => ({ box: boxToSheet(grow(pieceBox(piece), piece.kind === 'door' ? piece.w : foot)) })),
      ...badges.map((badge) => ({ box: grow({ left: badge.x, right: badge.x, top: badge.y, bottom: badge.y }, BADGE_RADIUS + 2) })),
    ];

    const places = namePlaces(room);
    const seatsOn = new Map<string, number>();
    for (const seat of room.seats) seatsOn.set(seat.furnitureId, (seatsOn.get(seat.furnitureId) ?? 0) + 1);
    const tableMiddles = new Map<string, Point>();
    for (const key of tables) {
      const box = boundsOf(desks.filter((piece) => tableOf(piece) === key));
      if (box) tableMiddles.set(key, middleOf(box));
    }
    const nameSeats: NameSeat[] = seats.map((seat: SheetSeat) => {
      const piece = seat.piece ? pieceById.get(seat.piece) : undefined;
      const chair = toSheet(seat);
      // On a rug each name finds its own spot: a rug holds the whole class, too many to move as one.
      const table = piece && piece.kind !== 'carpet' ? tableOf(piece) : seat.id;
      const middle = piece ? toSheet(piece.kind === 'carpet' ? piece : (tableMiddles.get(table) ?? piece)) : chair;
      const [dx, dy] = [chair.x - middle.x, chair.y - middle.y];
      const length = Math.hypot(dx, dy);
      const away = length > 0 ? { x: dx / length, y: dy / length } : { x: 0, y: 1 };
      if (!piece || piece.kind === 'carpet') {
        return { id: seat.id, name: seat.name, color: chart.showColors ? seat.color : null, table, chair, onDesk: { ...chair, room: 0 }, along: null, away, reach: deskUnit(room) * SPOT_SHARE * scale };
      }
      const place = places.get(seat.id);
      const at = place ? toSheet(place) : toSheet(piece);
      const alone = seatsOn.get(piece.id) === 1;
      const angle = readingAngle({ rotation: piece.rotation + (piece.h > piece.w ? 90 : 0) });
      return {
        id: seat.id,
        name: seat.name,
        color: chart.showColors ? seat.color : null,
        table,
        chair,
        onDesk: { ...at, room: (place?.width ?? piece.w) * scale },
        along: alone && angle !== 0 ? { angle, room: Math.max(piece.w, piece.h) * DESK_FILL * scale } : null,
        away,
        reach: chairSize * 0.55 * scale,
      };
    });
    const nameBounds = grow(floor, -4);
    const plan = placeNames(nameSeats, obstacles, nameBounds, present ? PRESENT_NAME_FONTS : SHEET_NAME_FONTS, present ? CROWDED_PRESENT_FONTS : CROWDED_NAME_FONTS);

    // The cards beside the room, or under it: moving day first, then the list.
    const cardX = below ? MARGIN : SHEET_WIDTH - MARGIN - SIDE_WIDTH;
    const cardWidth = below ? SHEET_WIDTH - MARGIN * 2 : SIDE_WIDTH;
    const cardsTop = below ? drawing.y + drawing.height + GAP : roomTop;
    const directions = steps.length > 0 ? layoutDirections(steps, cardX, cardsTop, cardWidth, below ? Math.min(UNDER_STEP_COLUMNS, steps.length) : 1) : null;
    const listTop = directions ? directions.card.y + directions.card.height + CARD.gap : cardsTop;
    const list = hasList ? layoutList(doc, cardX, listTop, cardWidth, below ? UNDER_LIST_COLUMNS : LIST.columns) : null;
    const sideBottom = list ? list.card.y + list.card.height : directions ? directions.card.y + directions.card.height : cardsTop;
    const contentBottom = Math.max(drawing.y + drawing.height, sideBottom);
    const height = present ? PRESENT_HEIGHT : contentBottom + FOOTER.room;

    return {
      width: SHEET_WIDTH,
      height,
      header: { title: chart.title, titleFont, titleY, subtitle: present ? '' : chart.subtitle, subtitleY, pillY, date, chipWidth, chipY: titleTop + (titleFont - HEADER.chipHeight) / 2 },
      footerY: present ? null : height - FOOTER.room / 2 + FOOTER.font / 3,
      room,
      drawing,
      board,
      desks,
      tableOf,
      tables,
      furniture,
      features: shownFeatures,
      chairs,
      spots,
      chairSize,
      font: plan.font,
      tags: plan.tags,
      badges,
      directions,
      list,
    };
  };
  if (!hasSide) return arrange(false);
  // Beside the room, or under it: whichever prints the names bigger, beside when it's the same.
  const beside = arrange(false);
  const under = arrange(true);
  return printedSize(under.font, under) > printedSize(beside.font, beside) ? under : beside;
}

/** How big `size` sheet units come out printed, with the page turned whichever way fits the sheet best. */
export function printedSize(size: number, sheet: { width: number; height: number }): number {
  const wide = Math.min(PRINT_PAGE.long / sheet.width, PRINT_PAGE.short / sheet.height);
  const tall = Math.min(PRINT_PAGE.short / sheet.width, PRINT_PAGE.long / sheet.height);
  return size * Math.max(wide, tall);
}

/** True when the chart is drawn turned from the room as the teacher set it up. */
export function isTurned(doc: ClassroomDocument): boolean {
  return frontOf(doc.room) !== 'top';
}
