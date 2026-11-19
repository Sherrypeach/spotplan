import type { ClassroomDocument, DocSpot, DocStudent } from '@modules/classroom/document';
import type { Layout } from '@modules/layouts/types';
import { fittedSize, placeLayout } from '@modules/room/layoutPlacement';
import { UNITS_PER_DESK } from '@modules/room/roomGroups';
import { addFeature, moveFeature, wallFeatures } from '@modules/room/wallFeatures';

/** The example team: 24 people in the Benching layout. */
export const EXAMPLE_LAYOUT_ID = 'desks-banquet';
export const EXAMPLE_CLASS_NAME = 'Example team';

// The class's color tags: pink and blue.
const PINK = 0;
const BLUE = 2;

type Row = [name: string, level: 1 | 2 | 3, color: number, needs?: DocStudent['needs'], note?: string];

const ROSTER: Row[] = [
  ['Nora', 1, PINK, { 'fewer-neighbors': 'must' }],
  ['Leo', 1, PINK],
  ['Isabella', 1, PINK, { 'helper-nearby': 'must' }],
  ['Theo', 1, BLUE],
  ['Anna-Sofia', 1, BLUE, { 'near-front': 'must' }],
  ['Mateo', 1, BLUE, { 'near-front': 'must' }],
  ['Eli', 1, BLUE, { 'helper-nearby': 'must' }],
  ['Valeria', 2, PINK, { 'near-front': 'must' }],
  ['Zoe', 2, PINK, { 'helper-nearby': 'must' }],
  ['Hazel', 2, PINK],
  ['Ava', 2, PINK],
  ['Benjamin', 2, BLUE],
  ['Samuel', 2, BLUE, {}, 'Works best near a friend.'],
  ['Lucia', 3, PINK, {}, 'Stays focused in a busy room.'],
  ['Camila', 3, PINK],
  ['Emma', 3, PINK],
  ['Mia', 3, PINK],
  ['Ivy', 3, PINK],
  ['Olivia', 3, PINK],
  ['Max', 3, BLUE],
  ['Noah', 3, BLUE],
  ['Sam', 3, BLUE],
  ['Diego', 3, BLUE],
  ['Liam', 3, BLUE],
];

// Where the teacher spends time, and the door, in the layout's desk units.
const SPOTS: { x: number; y: number; time: DocSpot['time'] }[] = [
  { x: 5.36, y: 2.6, time: 'most' },
  { x: 5.36, y: 5.6, time: 'sometimes' },
  { x: 0.756, y: 7.399, time: 'sometimes' },
];
const DOOR_X = 9.8;

/** Fills a new class with the example: roster, levels, needs, colors, desks, the teacher's spots and a door. */
export function exampleClass(doc: ClassroomDocument, layout: Layout): ClassroomDocument {
  const students: DocStudent[] = ROSTER.map(([name, level, color, needs = {}, note = ''], index) => ({
    id: `ex${index + 1}`,
    name,
    level,
    color,
    needs,
    note,
  }));
  const idOf = (name: string) => students.find((student) => student.name === name)!.id;
  let room = placeLayout(doc.room, layout, fittedSize(doc.room, layout));
  // Where the layout's own units landed in the room, from one placed desk.
  const first = layout.furniture[0];
  const placed = room.pieces.find((piece) => piece.id === `L-${first.id}`)!;
  const unit = UNITS_PER_DESK * (room.layout?.size ?? 1);
  const toRoom = (x: number, y: number) => ({ x: placed.x + (x - first.x) * unit, y: placed.y + (y - first.y) * unit });
  room = {
    ...room,
    spots: SPOTS.map((spot, index) => ({ id: `spot${index + 1}`, time: spot.time, ...toRoom(spot.x, spot.y) })),
  };
  room = addFeature(room, 'door');
  room = moveFeature(room, wallFeatures(room)[0].id, { x: toRoom(DOOR_X, 0).x, y: room.depth });
  return {
    ...doc,
    students,
    keepApart: [{ a: idOf('Eli'), b: idOf('Nora') }],
    colors: { ...doc.colors, enabled: true },
    room,
  };
}
