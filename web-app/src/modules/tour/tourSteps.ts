import { DESKS_PART_PATH, SHAPE_PART_PATH } from '@modules/room/parts';
import { SEAT_STUDENTS_PART_PATH } from '@modules/seats/parts';
import { STEPS, type StepKey } from '@modules/steps/steps';
import { NAMES_PART_PATH } from '@modules/students/parts';

/** One stop of the tour: the page it shows, the part it points at (a data-tour mark), what it says, and which app step it's about (for its color). */
export type TourStep = { path: string; target: string; title: string; body: string; step?: StepKey };

// Each text still makes sense when its part isn't on the page yet (an empty class, privacy on).
export const TOUR_STEPS: TourStep[] = [
  {
    path: NAMES_PART_PATH,
    target: 'steps',
    title: 'Four steps',
    body: 'Your team goes through these four steps, in order. A check mark means a step is done.',
  },
  {
    path: NAMES_PART_PATH,
    target: 'add-students',
    step: 'students',
    title: 'Add your team',
    body: 'In Teammates, paste your team list or drop in a spreadsheet. Then sort each teammate into level 1, 2 or 3.',
  },
  {
    path: SHAPE_PART_PATH,
    target: 'room-drawing',
    step: 'room',
    title: 'Draw your room',
    body: 'Drag the circles on the walls to make the room your size. Beside it, add doors, windows and your furniture, and pick the screen’s wall.',
  },
  {
    path: DESKS_PART_PATH,
    target: 'layouts',
    step: 'room',
    title: 'Choose a desk layout',
    body: 'Pick a card to see those desks in your room, then use it. Drag desks or tables in the drawing to where they really are.',
  },
  {
    path: SEAT_STUDENTS_PART_PATH,
    target: 'place-students',
    step: 'seats',
    title: 'Seat everyone',
    body: 'Once your team and layout are in, press Place teammates to seat everyone by level and needs. Drag one name onto another to swap them.',
  },
  {
    path: STEPS[3].path,
    target: 'chart-actions',
    step: 'chart',
    title: 'Print or save',
    body: 'When everyone has a seat, show the chart on the projector, save it as an image, or print it for moving day.',
  },
];
