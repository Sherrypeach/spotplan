// What the API accepts, checked on every save. The API keeps the same numbers
// in classroom-limits.ts and password-rules.ts;
// serverLimits.test.ts compares the two when both are checked out side by side.

export const MAX_STUDENTS = 60;
export const MAX_KEEP_APART = 200;
export const MAX_PIECES = 200;
export const MAX_SEATS = 100;
export const MAX_SPOTS = 15;
export const MAX_SAVED_LAYOUTS = 8;
export const MAX_SAVED_CHARTS = 30;
// Text lengths: a student's name (and a saved chart's), a private note, a color tag's name.
export const MAX_NAME = 60;
export const MAX_NOTE = 500;
export const MAX_TAG_NAME = 20;
export const MAX_CHART_TITLE = 80;
export const MAX_DIRECTION = 200;
export const MAX_DIRECTIONS = 12;
// A layout's size, as a share of real desk size.
export const MIN_LAYOUT_SIZE = 0.45;
export const MAX_LAYOUT_SIZE = 1.15;
export const MAX_CLASS_NAME = 60;
export const MAX_CLASSES_PER_TEACHER = 20;
// Passwords (the API's password-rules.ts): bcrypt reads only the first 72 bytes.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;
