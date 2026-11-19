import type { Level, NeedKind, NeedStrength } from '@modules/seating/engine/types';

/**
 * One class, saved as one document: roster, room, seating, past charts and
 * settings. Mirrors the API's ClassroomDocument; the API checks every field
 * on save, so this side only reads and edits it.
 */
export const CLASSROOM_DOCUMENT_VERSION = 1;

export type DocStudent = {
  id: string;
  name: string;
  /** 1 = needs extra support, 3 = could sit anywhere; null until leveled. */
  level: Level | null;
  /** Index of one of the class's four color tags. */
  color: number | null;
  needs: Partial<Record<NeedKind, NeedStrength>>;
  /** Private: never on a chart, an image, a print or in logs. */
  note: string;
};

export type KeepApartPair = { a: string; b: string };

export type ColorTag = { name: string; inUse: boolean };

export type WallSide = 'top' | 'right' | 'bottom' | 'left';
export type RoomCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type RoomShape = 'rectangle' | 'square' | 'wide' | 'long' | 'l-shape';

/** Furniture, wall features (door, window, board, coat hooks) and layout pieces. Centers, in room units. */
export type DocPiece = {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipH: boolean;
  name?: string;
  wall?: WallSide;
  inset?: number;
  label?: string;
  shape?: string;
  sweep?: number;
  /** Desks of one table or pod share a group, so they're picked up together. */
  group?: string;
};

export type DocSeat = { id: string; furnitureId: string; x: number; y: number; facing: number };

export type DocSpot = { id: string; x: number; y: number; time: 'most' | 'sometimes' | 'not-much'; pieceId?: string };

/**
 * The room, in units where a desk is 72.4 wide; the front wall is `front`, the
 * top when missing. modules/room/units.ts converts to feet for the teacher.
 */
export type DocRoom = {
  shape: RoomShape;
  width: number;
  depth: number;
  cutCorner?: RoomCorner;
  cutWidth?: number;
  cutDepth?: number;
  pieces: DocPiece[];
  /** The layout in use, its size, and the size it was first placed at (so resizing the room isn't taken for the teacher's change). */
  layout: { id: string; size: number; fitted?: number } | null;
  seats: DocSeat[];
  spots: DocSpot[];
  labels: Record<string, 1 | 2 | 3>;
  handSetLabels: string[];
  locked: boolean;
  /** The wall with the board: the front of the room. Missing means the top wall. */
  front?: WallSide;
  /** Layouts the teacher changed and then left for another, by layout id, to bring back if picked again. */
  savedLayouts?: Record<string, SavedLayout>;
};

export type SavedLayout = { size: number; pieces: DocPiece[]; seats: DocSeat[] };

/** Seat id → student id. */
export type SeatAssignment = Record<string, string>;

export type PastChart = { at: string; assignment: SeatAssignment };

export type SavedChart = { id: string; name: string; savedAt: string; layoutId: string; assignment: SeatAssignment };

/** How the clean chart looks: names only, never levels, needs or notes. */
export type ChartStyle = 'classroom' | 'clean' | 'bright' | 'chalk';

export type DocChart = {
  title: string;
  subtitle: string;
  /** The whole room, or just the seats zoomed to fill the page. */
  view: 'room' | 'seats';
  showDoors: boolean;
  showColors: boolean;
  showDirections: boolean;
  /** A list of every table's students under the drawing, e.g. for a sub. */
  showList: boolean;
  /** How the chart looks: a wood classroom, black and white, pastel colors, or a chalkboard. */
  style: ChartStyle;
  /** The teacher's furniture, the windows and the rug on the chart. */
  showFurniture: boolean;
  showWindows: boolean;
  showRug: boolean;
  /** One step per line; empty means the starting directions. */
  directions: string[];
};

export type ClassroomDocument = {
  version: number;
  students: DocStudent[];
  keepApart: KeepApartPair[];
  colors: { enabled: boolean; tags: ColorTag[] };
  settings: {
    balanceColors: boolean;
    usePastCharts: boolean;
    askLevelQuestions: boolean;
    firstNamesOnly: boolean;
    feedback: Record<string, number>;
  };
  room: DocRoom;
  seating: { assignment: SeatAssignment; lockedSeats: string[]; checkedOff: string[] };
  /** The charts before the current one, newest first. */
  history: PastChart[];
  savedCharts: SavedChart[];
  chart: DocChart;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A class saved by a newer version of the app than this tab is running. */
export class OutdatedAppError extends Error {}

/** Accepts what the API sends back; anything else means the app is out of date. */
export function asClassroomDocument(value: unknown): ClassroomDocument {
  const looksRight =
    isRecord(value) &&
    value.version === CLASSROOM_DOCUMENT_VERSION &&
    Array.isArray(value.students) &&
    Array.isArray(value.keepApart) &&
    isRecord(value.colors) &&
    isRecord(value.settings) &&
    isRecord(value.seating) &&
    isRecord(value.room) &&
    Array.isArray(value.room.pieces);
  if (!looksRight) throw new OutdatedAppError('This team was saved by a newer version of the app. Reload the page.');
  const doc = value as ClassroomDocument;
  // Classes saved before these chart settings existed have none of them.
  return {
    ...doc,
    chart: {
      ...doc.chart,
      showList: doc.chart.showList ?? false,
      style: doc.chart.style ?? 'classroom',
      showFurniture: doc.chart.showFurniture ?? true,
      showWindows: doc.chart.showWindows ?? true,
      showRug: doc.chart.showRug ?? true,
    },
  };
}
