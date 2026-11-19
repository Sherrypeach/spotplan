import { IconArmchair, IconLayoutGrid, IconPrinter, IconUsers, type Icon } from '@tabler/icons-react';

import type { ClassroomDocument } from '@modules/classroom/document';
import { currentAssignment } from '@modules/seats/seatingModel';

export type StepKey = 'students' | 'room' | 'seats' | 'chart';

export type Step = {
  key: StepKey;
  number: number;
  label: string;
  title: string;
  path: string;
  icon: Icon;
  tip: string;
  /** Tailwind classes for the step's colored stamp (circle + glyph). */
  stampClass: string;
  /** The step's color as a border, e.g. the line beside its tip. */
  accentClass: string;
};

// The four steps, in order.
export const STEPS: Step[] = [
  {
    key: 'students',
    number: 1,
    label: 'Teammates',
    title: 'Add your teammates',
    path: '/students',
    icon: IconUsers,
    tip: 'Add the people on your team, then set each one’s level.',
    stampClass: 'bg-step-students text-stamp-ink',
    accentClass: 'border-step-students',
  },
  {
    key: 'room',
    number: 2,
    label: 'Room',
    title: 'Set up your room',
    path: '/room',
    icon: IconLayoutGrid,
    tip: 'Draw your room, then pick your layout.',
    stampClass: 'bg-step-room text-stamp-ink',
    accentClass: 'border-step-room',
  },
  {
    key: 'seats',
    number: 3,
    label: 'Seats',
    title: 'Seat everyone',
    path: '/seats',
    icon: IconArmchair,
    tip: 'We’ll seat your team for you. You can swap any two teammates.',
    stampClass: 'bg-step-seats text-stamp-ink',
    accentClass: 'border-step-seats',
  },
  {
    key: 'chart',
    number: 4,
    label: 'Chart',
    title: 'Print your chart',
    path: '/chart',
    icon: IconPrinter,
    tip: 'Print your chart, or save it to use again later.',
    stampClass: 'bg-step-chart text-stamp-ink',
    accentClass: 'border-step-chart',
  },
];

/** The step a page belongs to: its own path or anything below it. */
export function stepAt(pathname: string): Step | undefined {
  return STEPS.find((step) => pathname === step.path || pathname.startsWith(`${step.path}/`));
}

export function nextStep(step: Step): Step | undefined {
  return STEPS[STEPS.indexOf(step) + 1];
}

export function previousStep(step: Step): Step | undefined {
  const index = STEPS.indexOf(step);
  return index > 0 ? STEPS[index - 1] : undefined;
}

/**
 * Whether a step's work is really done for this class: everyone has a level,
 * the desks are set up, everyone has a seat, a chart was saved.
 */
export function isStepDone(key: StepKey, doc: ClassroomDocument): boolean {
  const seated = new Set(Object.values(currentAssignment(doc)));
  switch (key) {
    case 'students':
      return doc.students.length > 0 && doc.students.every((student) => student.level !== null);
    case 'room':
      return doc.room.layout !== null && doc.room.seats.length > 0;
    case 'seats':
      return doc.students.length > 0 && doc.students.every((student) => seated.has(student.id));
    case 'chart':
      return doc.savedCharts.length > 0;
  }
}
