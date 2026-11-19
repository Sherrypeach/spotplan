import type { ClassroomDocument, DocChart, DocRoom, SavedChart, SeatAssignment } from '@modules/classroom/document';
import { toFrontUp } from '@modules/room/frontFrame';
import { deskUnit, pieceGroups } from '@modules/room/roomGroups';
import { currentAssignment } from '@modules/seats/seatingModel';
import { shownNames } from '@modules/seats/seatNames';
import { MAX_CHART_TITLE, MAX_DIRECTION, MAX_DIRECTIONS, MAX_NAME, MAX_SAVED_CHARTS } from '@shared/serverLimits';

/** The starting directions for moving day. */
export const DEFAULT_DIRECTIONS = [
  'Pack your laptop, cables and personal items before you leave on the last day.',
  'Label your bag or box with your name.',
  'Find your new desk on this chart.',
  'Set up your monitor and cables, and check that everything works.',
  'Say hi to your new neighbors!',
];

export const MAX_TITLE = MAX_CHART_TITLE;
export { MAX_DIRECTIONS, MAX_DIRECTION };
const MAX_CHART_NAME = MAX_NAME;

/** The steps as saved, or the starting steps before any were written. */
export function directionsOf(chart: DocChart): string[] {
  return chart.directions.length > 0 ? chart.directions : DEFAULT_DIRECTIONS;
}

/** The steps the chart shows: blank ones are left out. */
export function shownDirections(chart: DocChart): string[] {
  const steps = directionsOf(chart).filter((step) => step.trim());
  return steps.length > 0 ? steps : DEFAULT_DIRECTIONS;
}

export function setChart(doc: ClassroomDocument, patch: Partial<DocChart>): ClassroomDocument {
  return { ...doc, chart: { ...doc.chart, ...patch } };
}


/** One seated student as the chart shows them: name only, and a color tag when shown. */
export type SheetSeat = {
  id: string;
  studentId: string;
  x: number;
  y: number;
  name: string;
  color: number | null;
  piece: string | null;
};

/** The seated students for the chart. Nothing private: no levels, needs or notes. */
export function sheetSeats(doc: ClassroomDocument): SheetSeat[] {
  const assignment = currentAssignment(doc);
  const students = new Map(doc.students.map((student) => [student.id, student]));
  const pieces = new Map(doc.room.pieces.map((piece) => [piece.id, piece]));
  // With first names only on, every place the chart shows a name shortens it.
  const short = doc.settings.firstNamesOnly ? shownNames(doc.students) : null;
  return doc.room.seats.flatMap((seat) => {
    const student = students.get(assignment[seat.id]);
    if (!student) return [];
    const piece = pieces.get(seat.furnitureId);
    const tag = student.color !== null && doc.colors.enabled && doc.colors.tags[student.color]?.inUse ? student.color : null;
    return [
      {
        id: seat.id,
        studentId: student.id,
        x: seat.x,
        y: seat.y,
        name: short?.get(student.id) ?? student.name,
        color: tag,
        piece: piece ? piece.id : null,
      },
    ];
  });
}

/** One table (or desk, or rug) on the chart: its number, where it is, and who sits there. */
export type SheetTable = { number: number; x: number; y: number; seats: SheetSeat[] };

/**
 * The tables that have someone sitting at them, numbered front to back, then
 * left to right, with their students in the same order.
 */
export function sheetTables(doc: ClassroomDocument): SheetTable[] {
  // Desks pushed together are one table, even in rooms saved before tables were grouped.
  const tableOf = pieceGroups(doc.room);
  const groups = new Map<string, { pieces: string[]; seats: SheetSeat[] }>();
  for (const seat of sheetSeats(doc)) {
    const members = seat.piece ? (tableOf.get(seat.piece) ?? [seat.piece]) : [];
    const key = members[0] ?? seat.id;
    const group = groups.get(key) ?? { pieces: members, seats: [] };
    group.seats.push(seat);
    groups.set(key, group);
  }
  const pieces = new Map(doc.room.pieces.map((piece) => [piece.id, piece]));
  const tables = [...groups.values()].map(({ pieces: ids, seats }) => {
    const tablePieces = ids.flatMap((id) => pieces.get(id) ?? []);
    const spots = tablePieces.length > 0 ? tablePieces : seats;
    return {
      x: spots.reduce((sum, p) => sum + p.x, 0) / spots.length,
      y: spots.reduce((sum, p) => sum + p.y, 0) / spots.length,
      seats: inReadingOrder(seats, doc.room),
    };
  });
  return inReadingOrder(tables, doc.room).map((table, index) => ({ ...table, number: index + 1 }));
}

/**
 * Front to back from the board, then left to right as the class sees it. A new
 * row starts only where the next thing is more than half a desk further back
 * than the one before, so things almost level stay in one row.
 */
export function inReadingOrder<T extends { x: number; y: number }>(items: T[], room: DocRoom): T[] {
  const rowGap = deskUnit(room) / 2;
  const up = toFrontUp({ ...room, pieces: [], seats: [], spots: items.map((item, index) => ({ id: String(index), x: item.x, y: item.y, time: 'most' as const })) }).spots;
  const order = items.map((item, index) => ({ item, x: up[index].x, y: up[index].y }));
  const rows: (typeof order)[] = [];
  for (const entry of [...order].sort((a, b) => a.y - b.y)) {
    const row = rows[rows.length - 1];
    if (row && entry.y - row[row.length - 1].y <= rowGap) row.push(entry);
    else rows.push([entry]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x).map((entry) => entry.item));
}

function chartName(at: Date): string {
  const day = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`.slice(0, MAX_CHART_NAME);
}

function sameSeats(a: SeatAssignment, b: SeatAssignment): boolean {
  const seats = Object.keys(a);
  return seats.length === Object.keys(b).length && seats.every((seat) => a[seat] === b[seat]);
}

/** Keeps who sits where, so the next shuffle avoids the same seats and neighbors. Newest first. */
export function saveChart(doc: ClassroomDocument, at = new Date()): ClassroomDocument {
  const layoutId = doc.room.layout?.id;
  const assignment = currentAssignment(doc);
  if (!layoutId || Object.keys(assignment).length === 0) return doc;
  // The same seats again (Save tapped twice, or a chart brought back) would only crowd out an older chart.
  if (doc.savedCharts.some((chart) => chart.layoutId === layoutId && sameSeats(chart.assignment, assignment))) return doc;
  const saved: SavedChart = { id: `c${at.getTime().toString(36)}`, name: chartName(at), savedAt: at.toISOString(), layoutId, assignment };
  return { ...doc, savedCharts: [saved, ...doc.savedCharts.filter((chart) => chart.id !== saved.id)].slice(0, MAX_SAVED_CHARTS) };
}

/**
 * Puts a saved chart back, when it was made for the layout in the room now.
 * Locks stay where the same student sits in the same seat. A chart whose
 * seats are all gone changes nothing.
 */
export function restoreChart(doc: ClassroomDocument, chartId: string): ClassroomDocument {
  const chart = doc.savedCharts.find((candidate) => candidate.id === chartId);
  if (!chart || chart.layoutId !== doc.room.layout?.id) return doc;
  const restored = currentAssignment({ ...doc, seating: { ...doc.seating, assignment: chart.assignment } });
  if (Object.keys(restored).length === 0) return doc;
  const before = currentAssignment(doc);
  const lockedSeats = doc.seating.lockedSeats.filter((seat) => before[seat] && before[seat] === restored[seat]);
  return { ...doc, seating: { ...doc.seating, assignment: restored, lockedSeats } };
}

export function deleteChart(doc: ClassroomDocument, chartId: string): ClassroomDocument {
  return { ...doc, savedCharts: doc.savedCharts.filter((chart) => chart.id !== chartId) };
}
