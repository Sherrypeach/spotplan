/**
 * Everything a teacher sets up for one class, saved as one document: the
 * roster, the room, the seating, past charts and settings. It carries a
 * version so older saves and backups can be upgraded when the format changes.
 */
export const CLASSROOM_DOCUMENT_VERSION = 1;

/** The four walls of a room, as the document names them. */
export const WALL_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type WallSide = (typeof WALL_SIDES)[number];

export type NeedKind =
  | 'near-front'
  | 'face-front'
  | 'close-to-teacher'
  | 'near-door'
  | 'helper-nearby'
  | 'fewer-neighbors';

export interface DocStudent {
  id: string;
  name: string;
  /** 1 = needs extra support, 3 = could sit anywhere; null until leveled. */
  level: 1 | 2 | 3 | null;
  /** Index of one of the class's four color tags. */
  color: number | null;
  needs: Partial<Record<NeedKind, 'must' | 'nice'>>;
  /** Private: never on a chart, an image, a print or in logs. */
  note: string;
}

export interface Point {
  x: number;
  y: number;
}

/** Furniture, wall features (door, window, board, coat hooks) and layout pieces. */
export interface DocPiece extends Point {
  id: string;
  kind: string;
  w: number;
  h: number;
  rotation: number;
  flipH: boolean;
  name?: string;
  /** Wall features stick to one wall. */
  wall?: WallSide;
  inset?: number;
  label?: string;
  shape?: string;
  sweep?: number;
  /** Desks of one table or pod share a group, so they're picked up together. */
  group?: string;
}

export interface DocSeat extends Point {
  id: string;
  furnitureId: string;
  facing: number;
}

export interface DocSpot extends Point {
  id: string;
  time: 'most' | 'sometimes' | 'not-much';
  /** When the spot is a piece of furniture (the teacher's desk, a table, a rug, the board). */
  pieceId?: string;
}

export interface DocRoom {
  shape: 'rectangle' | 'square' | 'wide' | 'long' | 'l-shape';
  width: number;
  depth: number;
  cutCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  cutWidth?: number;
  cutDepth?: number;
  pieces: DocPiece[];
  /** The library layout in use and its size (a share of real desk size). */
  layout: { id: string; size: number; fitted?: number } | null;
  seats: DocSeat[];
  spots: DocSpot[];
  labels: Record<string, 1 | 2 | 3>;
  handSetLabels: string[];
  locked: boolean;
  /** The wall with the board: the front of the room. Missing means the top wall. */
  front?: WallSide;
  /**
   * Layouts the teacher changed (moved, turned, added desks) and then left for
   * another, by layout id, so picking one again brings back that version.
   */
  savedLayouts?: Record<string, SavedLayout>;
}

export interface SavedLayout {
  size: number;
  pieces: DocPiece[];
  seats: DocSeat[];
}

/** Seat id to student id. */
export type SeatAssignment = Record<string, string>;

export interface ClassroomDocument {
  version: number;
  students: DocStudent[];
  keepApart: { a: string; b: string }[];
  colors: { enabled: boolean; tags: { name: string; inUse: boolean }[] };
  settings: {
    balanceColors: boolean;
    usePastCharts: boolean;
    askLevelQuestions: boolean;
    firstNamesOnly: boolean;
    feedback: {
      spreadOutOnes: number;
      onesCloserToMe: number;
      fewerOnesPerTable: number;
    };
  };
  room: DocRoom;
  seating: {
    assignment: SeatAssignment;
    lockedSeats: string[];
    checkedOff: string[];
  };
  /** The charts before the current one, newest first. */
  history: { at: string; assignment: SeatAssignment }[];
  savedCharts: {
    id: string;
    name: string;
    savedAt: string;
    layoutId: string;
    assignment: SeatAssignment;
  }[];
  chart: {
    title: string;
    subtitle: string;
    view: 'room' | 'seats';
    showDoors: boolean;
    showColors: boolean;
    showDirections: boolean;
    /** A list of every table's students under the drawing, e.g. for a sub. */
    showList: boolean;
    /** How the chart looks: a wood classroom, black and white, pastel colors, or a chalkboard. */
    style: 'classroom' | 'clean' | 'bright' | 'chalk';
    /** The teacher's furniture, the windows and the rug on the chart (the whole-room view). */
    showFurniture: boolean;
    showWindows: boolean;
    showRug: boolean;
    directions: string[];
  };
}
