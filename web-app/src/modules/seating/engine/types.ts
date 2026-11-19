export type Point = { x: number; y: number };
export type Segment = { a: Point; b: Point };

// 1 is the highest-need level, 3 the most independent. Seat labels use the same
// scale: a 1 seat is the one that best supports a level 1 student.
export type Level = 1 | 2 | 3;

export type SeatLabels = Record<string, Level>;

export type TimeSpent = 'most' | 'sometimes' | 'not-much';

// A place the teacher spends time. Distance is measured to the nearest edge of
// its outline (a desk, table, rug or board), or to the point for a marker.
export type TeacherSpot = Point & {
  id: string;
  time: TimeSpent;
  outline?: Point[];
};

export type NeedKind =
  | 'near-front'
  | 'face-front'
  | 'close-to-teacher'
  | 'near-door'
  | 'helper-nearby'
  | 'fewer-neighbors';

export type NeedStrength = 'must' | 'nice';

export type Needs = Partial<Record<NeedKind, NeedStrength>>;

export type Student = {
  id: string;
  name: string;
  // Not leveled yet; the engine treats the student as a 3.
  level: Level | null;
  // Index of one of the teacher's color tags; what it means is up to them.
  color: number | null;
  needs: Needs;
};

// A student without a level counts as a 3 everywhere in the engine.
export const levelOrThree = (student: Student): Level => student.level ?? 3;

export type KeepApart = { a: string; b: string };

// Seat id to student id.
export type Assignment = Record<string, string>;

// The "Not quite right?" buttons: 0 = off, 1 = on, 2 = stronger.
export type Feedback = {
  spreadOutOnes: 0 | 1 | 2;
  onesCloserToMe: 0 | 1 | 2;
  fewerOnesPerTable: 0 | 1 | 2;
};

export const NO_FEEDBACK: Feedback = { spreadOutOnes: 0, onesCloserToMe: 0, fewerOnesPerTable: 0 };
