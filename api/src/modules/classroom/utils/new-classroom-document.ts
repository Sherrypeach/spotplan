import {
  ClassroomDocument,
  CLASSROOM_DOCUMENT_VERSION,
} from '@modules/classroom/interfaces/classroom-document.interface';

// Rooms are measured in units where a desk is 72.4 wide (about 2 ft). A new
// room is 30 by 24 ft, with the board on the top wall.
const UNITS_PER_FOOT = 72.4 / 2;
const DEFAULT_ROOM_WIDTH = Math.round(30 * UNITS_PER_FOOT);
const DEFAULT_ROOM_DEPTH = Math.round(24 * UNITS_PER_FOOT);

// The starting directions for students moving desks.
const DEFAULT_DIRECTIONS = [
  'Pack your laptop, cables and personal items before you leave on the last day.',
  'Label your bag or box with your name.',
  'Find your new desk on this chart.',
  'Set up your monitor and cables, and check that everything works.',
  'Say hi to your new neighbors!',
];

/** A new, empty class: no students, an empty rectangular room, colors off. */
export function newClassroomDocument(): ClassroomDocument {
  return {
    version: CLASSROOM_DOCUMENT_VERSION,
    students: [],
    keepApart: [],
    colors: {
      enabled: false,
      tags: ['Pink', 'Orange', 'Blue', 'Purple'].map((name) => ({
        name,
        inUse: true,
      })),
    },
    settings: {
      balanceColors: true,
      usePastCharts: true,
      askLevelQuestions: false,
      firstNamesOnly: true,
      feedback: { spreadOutOnes: 0, onesCloserToMe: 0, fewerOnesPerTable: 0 },
    },
    room: {
      shape: 'rectangle',
      width: DEFAULT_ROOM_WIDTH,
      depth: DEFAULT_ROOM_DEPTH,
      pieces: [],
      layout: null,
      seats: [],
      spots: [],
      labels: {},
      handSetLabels: [],
      locked: false,
    },
    seating: { assignment: {}, lockedSeats: [], checkedOff: [] },
    history: [],
    savedCharts: [],
    chart: {
      title: 'Office Seating Chart',
      subtitle: '',
      view: 'seats',
      showDoors: true,
      showColors: false,
      showDirections: true,
      showList: false,
      style: 'classroom',
      showFurniture: true,
      showWindows: true,
      showRug: true,
      directions: DEFAULT_DIRECTIONS,
    },
  };
}
