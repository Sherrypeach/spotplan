import {
  ClassroomDocument,
  CLASSROOM_DOCUMENT_VERSION,
  DocPiece,
  DocRoom,
  DocSeat,
  DocSpot,
  DocStudent,
  NeedKind,
  SavedLayout,
  SeatAssignment,
  WALL_SIDES,
} from '@modules/classroom/interfaces/classroom-document.interface';
import {
  assertUnique,
  bool,
  fail,
  id,
  idMap,
  integer,
  isoDate,
  list,
  number,
  oneOf,
  record,
  text,
} from '@modules/classroom/utils/document-fields';
import {
  MAX_CHART_TITLE,
  MAX_CHECKED_OFF,
  MAX_CHECKED_OFF_KEY,
  MAX_DIRECTION,
  MAX_DIRECTIONS,
  MAX_HISTORY,
  MAX_KEEP_APART,
  MAX_LAYOUT_ID,
  MAX_LAYOUT_SIZE,
  MAX_NAME,
  MAX_NOTE,
  MAX_PIECES,
  MAX_PIECE_TEXT,
  MAX_SAVED_CHARTS,
  MAX_SAVED_LAYOUTS,
  MAX_SEATS,
  MAX_SPOTS,
  MAX_STUDENTS,
  MAX_TAG_NAME,
  MIN_LAYOUT_SIZE,
} from '@modules/classroom/utils/classroom-limits';

const COLOR_TAGS = 4;
const COORDINATE_MIN = -100;
const COORDINATE_MAX = 5000;

const NEEDS: readonly NeedKind[] = [
  'near-front',
  'face-front',
  'close-to-teacher',
  'near-door',
  'helper-nearby',
  'fewer-neighbors',
];
const PIECE_KINDS = [
  'desk',
  'rectangle-table',
  'trapezoid-table',
  'triangle-table',
  'storage',
  'supply-desk',
  'carpet',
  'door',
  'window',
  'board',
  'coat-hooks',
  'teacher-desk',
  'teacher-chair',
  'small-group-table',
  'rug',
  'bookshelf',
  'cubbies',
  'sink',
  'computers',
  'other',
] as const;
const CARPET_SHAPES = [
  'rectangle',
  'oval',
  'circle',
  'semicircle',
  'wedge',
] as const;
const ROOM_SHAPES = ['rectangle', 'square', 'wide', 'long', 'l-shape'] as const;
const CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;
const TIMES = ['most', 'sometimes', 'not-much'] as const;

function coordinate(value: unknown, what: string): number {
  return number(value, COORDINATE_MIN, COORDINATE_MAX, what);
}

function student(value: unknown): DocStudent {
  const s = record(value, 'student');
  const needs = idMap<'must' | 'nice'>();
  for (const [need, strength] of Object.entries(
    record(s.needs ?? {}, 'needs'),
  )) {
    needs[oneOf(need, NEEDS, 'need')] = oneOf(
      strength,
      ['must', 'nice'] as const,
      'need strength',
    );
  }
  return {
    id: id(s.id, 'student id'),
    name: text(s.name, MAX_NAME, 'student name', { required: true }),
    level:
      s.level === null || s.level === undefined
        ? null
        : (integer(s.level, 1, 3, 'level') as 1 | 2 | 3),
    color:
      s.color === null || s.color === undefined
        ? null
        : integer(s.color, 0, COLOR_TAGS - 1, 'color tag'),
    needs,
    note: text(s.note ?? '', MAX_NOTE, 'private note'),
  };
}

function piece(value: unknown): DocPiece {
  const p = record(value, 'piece');
  const clean: DocPiece = {
    id: id(p.id, 'piece id'),
    kind: oneOf(p.kind, PIECE_KINDS, 'piece kind'),
    x: coordinate(p.x, 'piece x'),
    y: coordinate(p.y, 'piece y'),
    w: number(p.w, 0.01, COORDINATE_MAX, 'piece width'),
    h: number(p.h, 0.01, COORDINATE_MAX, 'piece depth'),
    rotation: number(p.rotation, -360, 360, 'piece rotation'),
    flipH: p.flipH === true,
  };
  if (p.name !== undefined)
    clean.name = text(p.name, MAX_PIECE_TEXT, 'piece name');
  if (p.wall !== undefined) clean.wall = oneOf(p.wall, WALL_SIDES, 'wall');
  if (p.inset !== undefined)
    clean.inset = number(p.inset, 0, 0.5, 'table inset');
  if (p.label !== undefined)
    clean.label = text(p.label, MAX_PIECE_TEXT, 'piece label');
  if (clean.kind === 'carpet')
    clean.shape = oneOf(p.shape, CARPET_SHAPES, 'carpet shape');
  if (p.sweep !== undefined)
    clean.sweep = number(p.sweep, 1, 360, 'carpet sweep');
  if (p.group !== undefined) clean.group = id(p.group, 'piece group');
  return clean;
}

function seat(value: unknown): DocSeat {
  const s = record(value, 'seat');
  return {
    id: id(s.id, 'seat id'),
    furnitureId: id(s.furnitureId, 'seat piece'),
    x: coordinate(s.x, 'seat x'),
    y: coordinate(s.y, 'seat y'),
    facing: number(s.facing, -360, 360, 'seat facing'),
  };
}

function spot(value: unknown, pieceIds: Set<string>): DocSpot {
  const s = record(value, 'teacher spot');
  const clean: DocSpot = {
    id: id(s.id, 'teacher spot id'),
    time: oneOf(s.time, TIMES, 'time spent'),
    x: coordinate(s.x, 'teacher spot x'),
    y: coordinate(s.y, 'teacher spot y'),
  };
  if (s.pieceId !== undefined) {
    const pieceId = id(s.pieceId, 'teacher spot piece');
    if (!pieceIds.has(pieceId))
      fail('a teacher spot points to a missing piece');
    clean.pieceId = pieceId;
  }
  return clean;
}

/** A layout as the teacher left it: its pieces and seats, which must point to those pieces. */
function savedLayout(value: unknown): SavedLayout {
  const v = record(value, 'saved layout');
  const pieces = list(v.pieces, MAX_PIECES, 'saved layout pieces').map(piece);
  const seats = list(v.seats, MAX_SEATS, 'saved layout seats').map(seat);
  assertUnique(
    pieces.map((p) => p.id),
    'saved layout piece',
  );
  assertUnique(
    seats.map((s) => s.id),
    'saved layout seat',
  );
  const pieceIds = new Set(pieces.map((p) => p.id));
  if (seats.some((s) => !pieceIds.has(s.furnitureId)))
    fail('a saved layout seat points to a missing piece');
  return {
    size: number(v.size, MIN_LAYOUT_SIZE, MAX_LAYOUT_SIZE, 'saved layout size'),
    pieces,
    seats,
  };
}

function savedLayouts(value: unknown): Record<string, SavedLayout> {
  const entries = Object.entries(record(value, 'saved layouts'));
  if (entries.length > MAX_SAVED_LAYOUTS) fail('too many saved layouts');
  const clean = idMap<SavedLayout>();
  for (const [layoutId, layout] of entries) {
    clean[id(layoutId, 'saved layout id')] = savedLayout(layout);
  }
  return clean;
}

function room(value: unknown): DocRoom {
  const r = record(value, 'room');
  const pieces = list(r.pieces, MAX_PIECES, 'pieces').map(piece);
  const seats = list(r.seats, MAX_SEATS, 'seats').map(seat);
  assertUnique(
    pieces.map((p) => p.id),
    'piece',
  );
  assertUnique(
    seats.map((s) => s.id),
    'seat',
  );
  const pieceIds = new Set(pieces.map((p) => p.id));
  if (seats.some((s) => !pieceIds.has(s.furnitureId)))
    fail('a seat points to a missing piece');
  const seatIds = new Set(seats.map((s) => s.id));
  const spots = list(r.spots, MAX_SPOTS, 'teacher spots').map((s) =>
    spot(s, pieceIds),
  );
  assertUnique(
    spots.map((s) => s.id),
    'teacher spot',
  );

  // Labels and hand-set marks for seats that were removed are dropped.
  const labels = idMap<1 | 2 | 3>();
  for (const [seatId, label] of Object.entries(
    record(r.labels ?? {}, 'seat labels'),
  )) {
    if (seatIds.has(seatId))
      labels[seatId] = integer(label, 1, 3, 'seat label') as 1 | 2 | 3;
  }
  const handSetLabels = list(
    r.handSetLabels ?? [],
    MAX_SEATS,
    'hand-set labels',
  )
    .map((s) => id(s, 'hand-set label'))
    .filter((s) => s in labels);

  const layoutValue =
    r.layout === null || r.layout === undefined
      ? null
      : record(r.layout, 'layout');
  const clean: DocRoom = {
    shape: oneOf(r.shape, ROOM_SHAPES, 'room shape'),
    width: number(r.width, 50, COORDINATE_MAX, 'room width'),
    depth: number(r.depth, 50, COORDINATE_MAX, 'room depth'),
    pieces,
    layout: layoutValue && {
      id: text(layoutValue.id, MAX_LAYOUT_ID, 'layout', { required: true }),
      size: number(
        layoutValue.size,
        MIN_LAYOUT_SIZE,
        MAX_LAYOUT_SIZE,
        'layout size',
      ),
      ...(layoutValue.fitted === undefined
        ? {}
        : {
            fitted: number(
              layoutValue.fitted,
              MIN_LAYOUT_SIZE,
              MAX_LAYOUT_SIZE,
              'layout fitted size',
            ),
          }),
    },
    seats,
    spots,
    labels,
    handSetLabels,
    locked: bool(r.locked ?? false, 'room lock'),
  };
  if (r.front !== undefined)
    clean.front = oneOf(r.front, WALL_SIDES, 'front wall');
  if (r.savedLayouts !== undefined)
    clean.savedLayouts = savedLayouts(r.savedLayouts);
  if (clean.shape === 'l-shape') {
    clean.cutCorner = oneOf(r.cutCorner, CORNERS, 'cut-out corner');
    clean.cutWidth = number(r.cutWidth, 1, clean.width, 'cut-out width');
    clean.cutDepth = number(r.cutDepth, 1, clean.depth, 'cut-out depth');
  }
  return clean;
}

/**
 * Seat to student pairs. Students no longer in the class drop out, so removing
 * a student removes them from every chart. Seats are checked against the room
 * only for the current seating; past charts may come from another layout.
 */
function assignment(
  value: unknown,
  studentIds: Set<string>,
  seatIds: Set<string> | null,
): SeatAssignment {
  const clean = idMap<string>();
  const seated = new Set<string>();
  for (const [seatId, studentId] of Object.entries(
    record(value ?? {}, 'chart'),
  )) {
    id(seatId, 'chart seat');
    if (seatIds && !seatIds.has(seatId)) continue;
    const who = id(studentId, 'chart student');
    if (!studentIds.has(who)) continue;
    if (seated.has(who)) fail('a student is seated twice');
    seated.add(who);
    clean[seatId] = who;
  }
  return clean;
}

// Checked-off keys name the students involved; keys naming a removed student go.
function checkedOff(value: unknown, studentIds: Set<string>): string[] {
  return list(value ?? [], MAX_CHECKED_OFF, 'checked-off items')
    .map((key) => text(key, MAX_CHECKED_OFF_KEY, 'checked-off item'))
    .filter((key) => {
      const named = key.split('|')[2] ?? '';
      return named === '' || named.split(',').every((s) => studentIds.has(s));
    });
}

function settings(value: unknown): ClassroomDocument['settings'] {
  const s = record(value, 'settings');
  const feedback = record(s.feedback ?? {}, 'feedback');
  const level = (v: unknown, what: string) => integer(v ?? 0, 0, 2, what);
  return {
    balanceColors: bool(s.balanceColors, 'balance colors'),
    usePastCharts: bool(s.usePastCharts, 'use past charts'),
    askLevelQuestions: bool(s.askLevelQuestions, 'level questions'),
    firstNamesOnly: bool(s.firstNamesOnly, 'first names only'),
    feedback: {
      spreadOutOnes: level(feedback.spreadOutOnes, 'spread out the 1s'),
      onesCloserToMe: level(feedback.onesCloserToMe, 'keep 1s closer'),
      fewerOnesPerTable: level(
        feedback.fewerOnesPerTable,
        'fewer 1s per table',
      ),
    },
  };
}

// How the chart is drawn: a wood classroom, ink-saving black and white, pastel colors, or a chalkboard.
const CHART_STYLES = ['classroom', 'clean', 'bright', 'chalk'] as const;

function chart(value: unknown): ClassroomDocument['chart'] {
  const c = record(value, 'chart settings');
  return {
    title: text(c.title, MAX_CHART_TITLE, 'chart title'),
    subtitle: text(c.subtitle ?? '', MAX_CHART_TITLE, 'chart subtitle'),
    view: oneOf(c.view, ['room', 'seats'] as const, 'chart view'),
    showDoors: bool(c.showDoors, 'show doors'),
    showColors: bool(c.showColors, 'show colors'),
    showDirections: bool(c.showDirections, 'show directions'),
    showList: bool(c.showList ?? false, 'show list'),
    style: oneOf(c.style ?? 'classroom', CHART_STYLES, 'chart style'),
    showFurniture: bool(c.showFurniture ?? true, 'show furniture'),
    showWindows: bool(c.showWindows ?? true, 'show windows'),
    showRug: bool(c.showRug ?? true, 'show rug'),
    directions: list(c.directions ?? [], MAX_DIRECTIONS, 'directions').map(
      (d) => text(d, MAX_DIRECTION, 'direction'),
    ),
  };
}

/** Checks a classroom document and rebuilds it from the known fields only. */
export function parseClassroomDocument(value: unknown): ClassroomDocument {
  const doc = record(value, 'document');
  if (doc.version !== CLASSROOM_DOCUMENT_VERSION) fail('unsupported version');

  const students = list(doc.students, MAX_STUDENTS, 'students').map(student);
  assertUnique(
    students.map((s) => s.id),
    'student',
  );
  const studentIds = new Set(students.map((s) => s.id));
  const keepApart = list(
    doc.keepApart ?? [],
    MAX_KEEP_APART,
    'keep-apart pairs',
  )
    .map((p) => record(p, 'keep-apart pair'))
    .map((p) => ({
      a: id(p.a, 'keep-apart student'),
      b: id(p.b, 'keep-apart student'),
    }))
    .filter((p) => p.a !== p.b && studentIds.has(p.a) && studentIds.has(p.b));

  const colorValue = record(doc.colors, 'color tags');
  const tags = list(colorValue.tags, COLOR_TAGS, 'color tags').map((t) => {
    const tag = record(t, 'color tag');
    return {
      name: text(tag.name, MAX_TAG_NAME, 'color tag name', { required: true }),
      inUse: bool(tag.inUse, 'color tag in use'),
    };
  });
  if (tags.length !== COLOR_TAGS) fail('there must be four color tags');

  const cleanRoom = room(doc.room);
  const seatIds = new Set(cleanRoom.seats.map((s) => s.id));
  const seatingValue = record(doc.seating, 'seating');
  const lockedSeats = list(
    seatingValue.lockedSeats ?? [],
    MAX_SEATS,
    'locked seats',
  )
    .map((s) => id(s, 'locked seat'))
    .filter((s) => seatIds.has(s));

  const history = list(doc.history ?? [], MAX_HISTORY, 'past charts').map(
    (h) => {
      const entry = record(h, 'past chart');
      return {
        at: isoDate(entry.at, 'past chart date'),
        assignment: assignment(entry.assignment, studentIds, null),
      };
    },
  );
  const savedCharts = list(
    doc.savedCharts ?? [],
    MAX_SAVED_CHARTS,
    'saved charts',
  ).map((c) => {
    const saved = record(c, 'saved chart');
    return {
      id: id(saved.id, 'saved chart id'),
      name: text(saved.name, MAX_NAME, 'saved chart name', { required: true }),
      savedAt: isoDate(saved.savedAt, 'saved chart date'),
      layoutId: text(saved.layoutId, MAX_LAYOUT_ID, 'saved chart layout', {
        required: true,
      }),
      assignment: assignment(saved.assignment, studentIds, null),
    };
  });
  assertUnique(
    savedCharts.map((c) => c.id),
    'saved chart',
  );

  return {
    version: CLASSROOM_DOCUMENT_VERSION,
    students,
    keepApart,
    colors: { enabled: bool(colorValue.enabled, 'color tags on'), tags },
    settings: settings(doc.settings),
    room: cleanRoom,
    seating: {
      assignment: assignment(seatingValue.assignment, studentIds, seatIds),
      lockedSeats,
      checkedOff: checkedOff(seatingValue.checkedOff, studentIds),
    },
    history,
    savedCharts,
    chart: chart(doc.chart),
  };
}
