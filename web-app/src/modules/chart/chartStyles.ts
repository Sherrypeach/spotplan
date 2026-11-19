import type { ChartStyle } from '@modules/classroom/document';

/**
 * The chart's colors, as fixed values: the same picture is projected, printed
 * and saved as an image, where the app's theme doesn't apply.
 */
export type ChartPalette = {
  PAPER: string;
  INK: string;
  MUTED: string;
  TITLE: string;
  /** The little bar above the title. */
  ACCENT: string;
  /** The date in the corner. */
  CHIP: string;
  CHIP_INK: string;
  /** The moving-day and table cards beside the room. */
  CARD: string;
  CARD_EDGE: string;
  /** The numbered circles, in turn. */
  STAMPS: string[];
  STAMP_INK: string;
  STAMP_EDGE: string;
  FLOOR: string;
  /** Soft dots on the floor, like the room drawing; none for a plain floor. */
  FLOOR_DOTS?: string;
  WALL: string;
  /** The wall's thickness on the sheet. */
  WALL_WIDTH: number;
  /** Rounded room corners, or square like the room drawing. */
  ROUND_ROOM: boolean;
  DESK: string;
  /** One color per table, in turn, instead of DESK. */
  TABLE_COLORS?: string[];
  DESK_EDGE: string;
  /** Words written on desks and furniture. */
  DESK_INK: string;
  /** Shelves and supply desks: furniture nobody sits at. */
  SIDE: string;
  SIDE_EDGE: string;
  RUG: string;
  RUG_EDGE: string;
  BOARD: string;
  BOARD_FRAME: string;
  BOARD_TEXT: string;
  CHAIR: string;
  CHAIR_EDGE: string;
  /** The chair's back, a darker strip away from the desk; none for a plain chair. */
  CHAIR_BACK?: string;
  TAG: string;
  TAG_EDGE: string;
  TAG_COLORS: string[];
  WINDOW: string;
  WINDOW_EDGE: string;
  DOOR: string;
  FOOTER: string;
};

// The class's color tags, the same in every style so a tag means the same thing on any chart.
const TAG_COLORS = ['#f7a294', '#f9cb9c', '#98d9ef', '#b4a7d6'];
// Coral, yellow and sage: the deck's three stamp colors.
const STAMPS = ['#f7a294', '#f6d699', '#93c2ae'];

export const CHART_STYLES: { style: ChartStyle; label: string }[] = [
  { style: 'classroom', label: 'Office' },
  { style: 'clean', label: 'Black and white' },
  { style: 'bright', label: 'Colorful' },
  { style: 'chalk', label: 'Dark' },
];

export const CHART_PALETTES: Record<ChartStyle, ChartPalette> = {
  // Just like the room drawing: a light floor with soft dots, wooden desks, chairs with backs.
  classroom: {
    PAPER: '#fdfcf8',
    INK: '#2f3b3a',
    MUTED: '#5d6968',
    TITLE: '#4a5aa6',
    ACCENT: '#ffd166',
    CHIP: '#e8ebf7',
    CHIP_INK: '#33417a',
    CARD: '#f0f2fa',
    CARD_EDGE: '#c9d0ec',
    STAMPS,
    STAMP_INK: '#2f3b3a',
    STAMP_EDGE: 'none',
    FLOOR: '#f6f5ef',
    FLOOR_DOTS: '#dcdfd9',
    WALL: '#7d8786',
    WALL_WIDTH: 3,
    ROUND_ROOM: false,
    DESK: '#f8ebcb',
    DESK_EDGE: '#8f6b37',
    DESK_INK: '#5a4320',
    SIDE: '#e8ece9',
    SIDE_EDGE: '#7d8786',
    RUG: '#ecdcbc',
    RUG_EDGE: '#b89a68',
    BOARD: '#33417a',
    BOARD_FRAME: '#8f6b37',
    BOARD_TEXT: '#fdfcf8',
    CHAIR: '#b5dcd6',
    CHAIR_EDGE: '#33403f',
    CHAIR_BACK: '#4f8a7b',
    TAG: '#ffffff',
    TAG_EDGE: '#c4dad1',
    TAG_COLORS,
    WINDOW: '#98d9ef',
    WINDOW_EDGE: '#7d8786',
    DOOR: '#8f6b37',
    FOOTER: '#9aa0a0',
  },
  // Black lines on white: saves ink when printing.
  clean: {
    PAPER: '#ffffff',
    INK: '#1f2928',
    MUTED: '#4a5150',
    TITLE: '#1f2928',
    ACCENT: '#1f2928',
    CHIP: '#ffffff',
    CHIP_INK: '#1f2928',
    CARD: '#ffffff',
    CARD_EDGE: '#9aa0a0',
    STAMPS: ['#ffffff'],
    STAMP_INK: '#1f2928',
    STAMP_EDGE: '#1f2928',
    FLOOR: '#ffffff',
    WALL: '#1f2928',
    WALL_WIDTH: 3,
    ROUND_ROOM: false,
    DESK: '#ffffff',
    DESK_EDGE: '#1f2928',
    DESK_INK: '#1f2928',
    SIDE: '#ededed',
    SIDE_EDGE: '#1f2928',
    RUG: '#f2f2f2',
    RUG_EDGE: '#6b7170',
    BOARD: '#1f2928',
    BOARD_FRAME: '#1f2928',
    BOARD_TEXT: '#ffffff',
    CHAIR: '#ffffff',
    CHAIR_EDGE: '#1f2928',
    TAG: '#ffffff',
    TAG_EDGE: '#6b7170',
    TAG_COLORS,
    WINDOW: '#ffffff',
    WINDOW_EDGE: '#1f2928',
    DOOR: '#1f2928',
    FOOTER: '#6b7170',
  },
  // Soft pastel tables, one color each, on a light floor. None of them is a color tag's color.
  bright: {
    PAPER: '#fffdf8',
    INK: '#2f3b3a',
    MUTED: '#5d6968',
    TITLE: '#4a5aa6',
    ACCENT: '#ffd166',
    CHIP: '#fde8dc',
    CHIP_INK: '#3d2318',
    CARD: '#f3f8f5',
    CARD_EDGE: '#7fae9f',
    STAMPS,
    STAMP_INK: '#2f3b3a',
    STAMP_EDGE: 'none',
    FLOOR: '#fdfcf8',
    WALL: '#4f8a7b',
    WALL_WIDTH: 5,
    ROUND_ROOM: true,
    DESK: '#fff1c9',
    TABLE_COLORS: ['#e3efd0', '#fff1b8', '#d6ece6', '#efe6d6', '#e4ecf2', '#f3eedd'],
    DESK_EDGE: '#5d6968',
    DESK_INK: '#2f3b3a',
    SIDE: '#eef1ef',
    SIDE_EDGE: '#7d8786',
    RUG: '#f3e3c3',
    RUG_EDGE: '#c9a86a',
    BOARD: '#3e7466',
    BOARD_FRAME: '#e08a62',
    BOARD_TEXT: '#fdfcf8',
    CHAIR: '#ffffff',
    CHAIR_EDGE: '#4f8a7b',
    TAG: '#ffffff',
    TAG_EDGE: '#7fae9f',
    TAG_COLORS,
    WINDOW: '#d8eef6',
    WINDOW_EDGE: '#4f8fae',
    DOOR: '#4f8a7b',
    FOOTER: '#9aa0a0',
  },
  // Chalk on a green board: reads well on a projector.
  chalk: {
    PAPER: '#24372f',
    INK: '#ffffff',
    MUTED: '#cfe0d8',
    TITLE: '#ffffff',
    ACCENT: '#f9cb9c',
    CHIP: '#2f4a3f',
    CHIP_INK: '#f4f1e6',
    CARD: '#2f4a3f',
    CARD_EDGE: '#8fae9f',
    STAMPS,
    STAMP_INK: '#24372f',
    STAMP_EDGE: 'none',
    FLOOR: '#2c4439',
    WALL: '#e6efe9',
    WALL_WIDTH: 4,
    ROUND_ROOM: false,
    DESK: '#35574a',
    DESK_EDGE: '#ffffff',
    DESK_INK: '#ffffff',
    SIDE: '#2f4a3f',
    SIDE_EDGE: '#cfe0d8',
    RUG: '#4a4f6e',
    RUG_EDGE: '#9a8fc4',
    BOARD: '#f4f1e6',
    BOARD_FRAME: '#c49a5c',
    BOARD_TEXT: '#24372f',
    CHAIR: '#2c4439',
    CHAIR_EDGE: '#f9cb9c',
    TAG: '#24372f',
    TAG_EDGE: '#ffffff',
    TAG_COLORS,
    WINDOW: '#98d9ef',
    WINDOW_EDGE: '#ffffff',
    DOOR: '#e8ebf7',
    FOOTER: '#9aa5d4',
  },
};
