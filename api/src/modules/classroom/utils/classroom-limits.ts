// Limits on what a class may hold, checked on every save. The web app keeps
// the same numbers in src/shared/serverLimits.ts (a test there compares them).

// Generous limits for one class; they keep a broken or hostile client from
// storing something huge.
export const MAX_DOCUMENT_CHARS = 400_000;
export const MAX_STUDENTS = 60;
export const MAX_KEEP_APART = 200;
export const MAX_PIECES = 200;
export const MAX_SEATS = 100;
export const MAX_SPOTS = 15;
// Layouts kept with the teacher's own changes, to bring back if picked again.
export const MAX_SAVED_LAYOUTS = 8;
export const MAX_HISTORY = 4;
export const MAX_SAVED_CHARTS = 30;
export const MAX_CHECKED_OFF = 500;
// Text lengths.
export const MAX_NAME = 60;
export const MAX_NOTE = 500;
export const MAX_PIECE_TEXT = 40;
export const MAX_LAYOUT_ID = 80;
export const MAX_CHART_TITLE = 80;
export const MAX_DIRECTION = 200;
export const MAX_TAG_NAME = 20;
export const MAX_CHECKED_OFF_KEY = 300;
// A layout's size, as a share of real desk size.
export const MIN_LAYOUT_SIZE = 0.45;
export const MAX_LAYOUT_SIZE = 1.15;
export const MAX_DIRECTIONS = 12;
// A class's name.
export const MAX_CLASS_NAME = 60;
// Classes one teacher may have.
export const MAX_CLASSES_PER_TEACHER = 20;
