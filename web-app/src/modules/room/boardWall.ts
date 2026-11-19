import type { ClassroomDocument, DocPiece, DocRoom, DocSeat, WallSide } from '@modules/classroom/document';
import type { Layout } from '@modules/layouts/types';
import { distanceToWall, frontOf, pointFromFrontUp, quartersBetween, toFrontUp } from '@modules/room/frontFrame';
import { furnitureOf, moveFurniture, turnFurniture } from '@modules/room/furniture';
import { fittedSize, isLayoutChanged, isLayoutPiece, placeLayout, setLayoutAside } from '@modules/room/layoutPlacement';
import { pieceBox } from '@modules/room/roomGeometry';
import { turnSelection } from '@modules/room/selection';
import { spotByBoard } from '@modules/room/teacherSpots';
import { UNITS_PER_FOOT } from '@modules/room/units';

export const BOARD_WALLS: { wall: WallSide; label: string }[] = [
  { wall: 'top', label: 'Top' },
  { wall: 'right', label: 'Right' },
  { wall: 'bottom', label: 'Bottom' },
  { wall: 'left', label: 'Left' },
];

// The "Where I teach" marker and the teacher's desk follow the board when this close to the old board wall.
const NEAR_BOARD = UNITS_PER_FOOT * 5;

// Pieces and seats turned about their own middle, clockwise by `degrees`.
function turnedAbout<P extends { x: number; y: number }>(items: P[], center: { x: number; y: number }, degrees: number): P[] {
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return items.map((item) => ({ ...item, x: center.x + (item.x - center.x) * cos - (item.y - center.y) * sin, y: center.y + (item.x - center.x) * sin + (item.y - center.y) * cos }));
}

// Layouts kept for later turn too, so one brought back faces the board.
function turnSavedLayouts(room: DocRoom, degrees: number): DocRoom {
  if (!room.savedLayouts || degrees % 360 === 0) return room;
  const savedLayouts = Object.fromEntries(
    Object.entries(room.savedLayouts).map(([id, saved]) => {
      const boxes = saved.pieces.map(pieceBox);
      const center = boxes.length
        ? { x: (Math.min(...boxes.map((b) => b.left)) + Math.max(...boxes.map((b) => b.right))) / 2, y: (Math.min(...boxes.map((b) => b.top)) + Math.max(...boxes.map((b) => b.bottom))) / 2 }
        : { x: 0, y: 0 };
      const pieces = turnedAbout(saved.pieces, center, degrees).map((piece: DocPiece) => ({ ...piece, rotation: (piece.rotation + degrees) % 360 }));
      const seats = turnedAbout(saved.seats, center, degrees).map((seat: DocSeat) => ({ ...seat, facing: (seat.facing + degrees) % 360 }));
      return [id, { ...saved, pieces, seats }];
    }),
  );
  return { ...room, savedLayouts };
}

// The teacher's desk by the old board goes to the same place by the new one, turned the same way.
function moveDesksAlong(before: DocRoom, after: DocRoom, degrees: number): DocRoom {
  const oldUp = toFrontUp(before);
  const newUp = toFrontUp(after);
  return furnitureOf(before)
    .filter((piece) => piece.kind === 'teacher-desk')
    .reduce((room, piece) => {
      const up = oldUp.pieces.find((candidate) => candidate.id === piece.id);
      if (!up || pieceBox(up).top > NEAR_BOARD) return room;
      const at = pointFromFrontUp(after, { x: (up.x / oldUp.width) * newUp.width, y: up.y });
      // Turned with its chair, a quarter at a time, then moved together.
      let turned = room;
      for (let quarter = 0; quarter < degrees / 90; quarter++) turned = turnFurniture(turned, piece.id);
      return moveFurniture(turned, piece.id, at);
    }, after);
}

/**
 * Moves the board to another wall, which becomes the front. The walls, doors,
 * windows and furniture stay, except the teacher's desk by the board, which
 * goes along. The desks turn to face the board: a layout the teacher never
 * changed is placed again facing it; a changed one turns as a whole, or, if
 * turned it won't fit, is kept for later and placed again. Seat labels stay.
 */
export function setBoardWall(doc: ClassroomDocument, wall: WallSide, layout: Layout | null): ClassroomDocument {
  const room = doc.room;
  const from = frontOf(room);
  if (wall === from) return doc;
  const degrees = 90 * quartersBetween(from, wall);
  let next: DocRoom = { ...turnSavedLayouts(room, degrees), front: wall };
  if (layout && room.layout?.id === layout.id) {
    const ids = room.pieces.filter((piece) => isLayoutPiece(piece.id)).map((piece) => piece.id);
    const changed = isLayoutChanged(room, layout);
    const turned = changed ? turnSelection(next, ids, degrees) : next;
    if (turned !== next) next = turned;
    else {
      const aside = changed ? turnSavedLayouts(setLayoutAside(room, layout), degrees) : next;
      next = { ...placeLayout({ ...next, savedLayouts: aside.savedLayouts }, layout, fittedSize(next, layout)), labels: room.labels, handSetLabels: room.handSetLabels };
    }
  }
  const marker = next.spots.find((spot) => !spot.pieceId);
  if (marker && distanceToWall(room, from, marker) <= NEAR_BOARD) {
    const at = spotByBoard(next);
    next = { ...next, spots: next.spots.map((spot) => (spot.id === marker.id ? { ...spot, ...at } : spot)) };
  }
  return { ...doc, room: moveDesksAlong(room, next, degrees) };
}
