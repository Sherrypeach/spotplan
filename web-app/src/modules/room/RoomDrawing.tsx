import { IconArrowsMove, IconFocusCentered, IconMinus, IconPlus, IconRotateClockwise2 } from '@tabler/icons-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import type { DocRoom, RoomCorner, WallSide } from '@modules/classroom/document';
import { isLayoutPiece, moveSpot, piecesOutsideWalls, piecesOverlapping } from '@modules/room/layoutPlacement';
import { furnitureName, furnitureOf, isFurniture, moveFurniture, turnFurniture } from '@modules/room/furniture';
import { FurnitureLayer } from '@modules/room/FurnitureLayer';
import { PiecesLayer, type Moving } from '@modules/room/PiecesLayer';
import { floorOutline, type Box, type Pt } from '@modules/room/roomGeometry';
import { boardLength, boardPlace, frontOf } from '@modules/room/frontFrame';
import { TOUCH_RADIUS_PX } from '@modules/room/drawingScale';
import { boundsOf, deskUnit, shiftPieces } from '@modules/room/roomGroups';
import { resizedRoom, shapeSummary } from '@modules/room/roomEdits';
import { clampMove, piecesInBox, selectionBounds, selectionCenter } from '@modules/room/selection';
import { toFeet, UNITS_PER_FOOT } from '@modules/room/units';
import { DrawingScale } from '@modules/room/drawingScale';
import { useDrawingZoom } from '@modules/room/useDrawingZoom';
import { useToolbarPlacement } from '@modules/room/useToolbarPlacement';
import { capturePointer, pastStart, roomPoint } from '@modules/room/pointerDrag';
import { isWallFeature, moveFeature, nearestWall, wallFeatures } from '@modules/room/wallFeatures';
import { WallFeaturesLayer } from '@modules/room/WallFeaturesLayer';
import { TeacherSpotsLayer } from '@modules/room/TeacherSpotsLayer';
import { moveTeacherSpot } from '@modules/room/teacherSpots';

/** Desks and tables that can be picked up, dragged, turned and moved with the keyboard (the Desks part). */
export type PieceControls = {
  selected: string[];
  /** What a drag starting on this piece moves: the selection if it's in it, else its table. */
  dragIdsFor: (id: string) => string[];
  /** One piece per table takes keyboard focus. */
  focusable: Set<string>;
  onClick: (id: string | null) => void;
  onMove: (ids: string[], dx: number, dy: number) => void;
  /** Picks up everything a box drawn over the floor caught. */
  onSelect: (ids: string[]) => void;
  /** Turns the selection clockwise by any number of degrees. */
  onTurn: (ids: string[], degrees: number) => void;
  onRemove: () => void;
};

/** Spots on a rug: picked up and dragged one by one. */
export type SpotControls = {
  picked: string | null;
  onPick: (id: string | null) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onRemove: () => void;
};

type Props = {
  room: DocRoom;
  /** When set (L-shape), each corner can be tapped to make it the missing one. */
  onPickCorner?: (corner: RoomCorner) => void;
  /** Where the teacher spends time: markers with their zones, dragged around the room. */
  teacher?: { selected: string | null; onSelect: (id: string | null) => void; onMove: (id: string, x: number, y: number) => void };
  /** When set, doors and windows can be dragged along the walls. */
  onMoveFeature?: (id: string, point: { x: number; y: number }) => void;
  /** Makes the teacher's furniture draggable (the Shape part). */
  /** The teacher's furniture: dragged, turned, and tapped to pick it up (its toolbar shows then). */
  furniture?: {
    onMove: (id: string, point: { x: number; y: number }) => void;
    /** Turns by any number of degrees clockwise (a quarter turn when not given). */
    onTurn: (id: string, degrees?: number) => void;
    picked?: string | null;
    onPick?: (id: string | null) => void;
  };
  /** Lets the board be dragged to another wall (the Shape part). */
  onBoardWall?: (wall: WallSide) => void;
  /** When set, the middle of every wall can be dragged to resize the room (in feet). */
  onResize?: (size: RoomResize) => void;
  /** Show the desks and seats (from the Desks part on; the room stays empty before). */
  showLayout?: boolean;
  /** Pieces outlined in dashed red. */
  problems?: Set<string>;
  /** A note shown in the middle of the empty room, e.g. "Pick your desks". */
  emptyMessage?: string;
  pieces?: PieceControls;
  spots?: SpotControls;
  /** Buttons floating next to what's picked up (Turn, Copy, Remove, Done). */
  toolbar?: ReactNode;
  /** Drawn over the desks in room units, e.g. seat labels or names (the Seats step). */
  seatLayer?: ReactNode;
  /** Zoom buttons and panning, to see small desks up close. */
  zoomable?: boolean;
  /** Where the toolbar goes when it isn't about desks or a rug spot, in room units. */
  toolbarAnchor?: { x: number; y: number };
  /** Buttons on the right of the zoom row, e.g. Undo. */
  actions?: ReactNode;
};

// The board is dragged like a door, under this id, by a handle this far from its middle (share of its width).
const BOARD_ID = 'board';
const BOARD_HANDLE_AT = 0.32;
// The board's arrow keys go around the walls in this order.
const WALL_ORDER: WallSide[] = ['top', 'right', 'bottom', 'left'];
// Turning snaps to this many degrees; hold Shift to turn freely.
const TURN_SNAP = 15;
// Dragging moves in half-foot steps; hold Shift to move freely.
const MOVE_SNAP = UNITS_PER_FOOT / 2;

/** A new size, and which walls moved: from the left or front wall, everything inside shifts with it. */
export type RoomResize = { width: number; depth: number; fromLeft: boolean; fromTop: boolean };

/** A resize handle: which side it pulls (-1 left/front, 1 right/back, 0 neither). */
type Handle = { h: -1 | 0 | 1; v: -1 | 0 | 1 };

const HANDLES: Handle[] = [
  { h: 0, v: -1 },
  { h: 1, v: 0 },
  { h: 0, v: 1 },
  { h: -1, v: 0 },
];

function handleCursor({ h }: Handle): string {
  return h === 0 ? 'cursor-ns-resize' : 'cursor-ew-resize';
}

const DOT_FEET = 2.5;
const ZOOM_BUTTON =
  'flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-sage-mist disabled:cursor-default disabled:opacity-40';
const CORNERS: RoomCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function cornerPoint(room: DocRoom, corner: RoomCorner): Pt {
  const x = corner.endsWith('left') ? 0 : room.width;
  const y = corner.startsWith('top') ? 0 : room.depth;
  return [x, y];
}

function snap(value: number, free: boolean): number {
  return free ? value : Math.round(value / MOVE_SNAP) * MOVE_SNAP;
}

/** True when the moved pieces stay inside the walls and off other tables. */
function movedFits(room: DocRoom, ids: string[], dx: number, dy: number): boolean {
  const moved = shiftPieces(room, new Set(ids), dx, dy);
  const bad = new Set([...piecesOutsideWalls(moved), ...piecesOverlapping(moved)]);
  return !ids.some((id) => bad.has(id));
}

const NUDGES: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * The teacher's room seen from above, with the board on its front wall.
 * The size is written on the walls; soft dots mark the floor.
 */
export function RoomDrawing({ room: savedRoom, onPickCorner, onResize, showLayout = false, problems, emptyMessage, pieces: pieceControls, spots, toolbar, seatLayer, zoomable = true, actions, toolbarAnchor, onMoveFeature, furniture, onBoardWall, teacher }: Props) {
  const dotsId = useId();
  const hatchId = useId();
  const clipId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // While a wall is dragged: the room as it would be, and the drawing's scale
  // frozen so the room doesn't shift under the pointer.
  const [drag, setDrag] = useState<{ handle: Handle; toRoom: DOMMatrix; width: number; depth: number } | null>(null);
  // A press on a desk, table or rug spot: a click until it moves, then a drag.
  // A box drawn over the empty floor with the mouse picks up every table it touches.
  const [lasso, setLasso] = useState<{ toRoom: DOMMatrix; startX: number; startY: number; box: Box | null; ids: string[] } | null>(null);
  const [grab, setGrab] = useState<{
    kind: 'piece' | 'spot';
    id: string;
    ids: string[];
    toRoom: DOMMatrix;
    startX: number;
    startY: number;
    dragging: boolean;
    dx: number;
    dy: number;
    fits: boolean;
  } | null>(null);
  // Turning by the round handle: picked desks and tables, or one piece of the teacher's furniture.
  const [spin, setSpin] = useState<{ ids: string[]; furnitureId?: string; toRoom: DOMMatrix; cx: number; cy: number; from: number; degrees: number } | null>(null);

  const sized = drag
    ? resizedRoom(savedRoom, { width: drag.width, depth: drag.depth, fromLeft: drag.handle.h === -1, fromTop: drag.handle.v === -1 })
    : savedRoom;
  // A door or window being dragged along the walls.
  const [featureDrag, setFeatureDrag] = useState<{
    id: string;
    toRoom: DOMMatrix;
    point: { x: number; y: number } | null;
    offset: { x: number; y: number };
    start: { x: number; y: number };
  } | null>(null);
  const [spotDrag, setSpotDrag] = useState<{ id: string; toRoom: DOMMatrix; startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null);
  const dragTo = (target: DocRoom, id: string, point: { x: number; y: number }) => (isFurniture({ id }) ? moveFurniture(target, id, point) : moveFeature(target, id, point));
  const withFeature = featureDrag?.point && featureDrag.id !== BOARD_ID ? dragTo(sized, featureDrag.id, featureDrag.point) : sized;
  const draggedSpot = spotDrag?.moved ? withFeature.spots.find((spot) => spot.id === spotDrag.id) : undefined;
  // The preview stays inside the room, where letting go will put it.
  const withSpot = spotDrag && draggedSpot ? moveTeacherSpot(withFeature, spotDrag.id, draggedSpot.x + spotDrag.dx, draggedSpot.y + spotDrag.dy) : withFeature;
  // Furniture being turned shows at its new angle while the handle moves.
  const room = spin?.furnitureId && spin.degrees ? turnFurniture(withSpot, spin.furnitureId, spin.degrees) : withSpot;
  // Pulling the left or front wall moves that wall: the drawing shifts so the other wall stays put.
  const shiftX = drag?.handle.h === -1 ? savedRoom.width - room.width : 0;
  const shiftY = drag?.handle.v === -1 ? savedRoom.depth - room.depth : 0;
  const outline = floorOutline(room);
  const points = outline.map(([x, y]) => `${x},${y}`).join(' ');
  // While the board is dragged, it shows on the wall it would land on.
  const boardRoom = featureDrag?.id === BOARD_ID && featureDrag.point ? { ...room, front: nearestWall(room, featureDrag.point) } : room;
  const board = boardPlace(boardRoom);
  const pad = UNITS_PER_FOOT * 1.5;
  const dots = UNITS_PER_FOOT * DOT_FEET;
  const target = UNITS_PER_FOOT * 1.6;
  const inset = UNITS_PER_FOOT * 2.5;
  // The view holds still while the room shrinks (the wall follows the pointer)
  // and only grows when the room outgrows it, so the drawing never spills out.
  const left = Math.min(-pad, shiftX - pad);
  const top = Math.min(-pad, shiftY - pad);
  const right = Math.max(savedRoom.width + pad, shiftX + room.width + pad);
  const bottom = Math.max(savedRoom.depth + pad, shiftY + room.depth + pad);
  const zoom = useDrawingZoom({ x: left, y: top, w: right - left, h: bottom - top }, zoomable, svgRef, drag !== null);
  // "Zoom to the desks": the layout with a little floor around it.
  const fitBox = useMemo(() => {
    const layoutBox = showLayout ? boundsOf(savedRoom.pieces.filter((piece) => isLayoutPiece(piece.id))) : null;
    return (
      layoutBox && {
        left: layoutBox.left - UNITS_PER_FOOT * 2,
        right: layoutBox.right + UNITS_PER_FOOT * 2,
        top: layoutBox.top - UNITS_PER_FOOT * 2,
        bottom: layoutBox.bottom + UNITS_PER_FOOT * 2,
      }
    );
  }, [showLayout, savedRoom.pieces]);
  const viewBox = `${zoom.view.x} ${zoom.view.y} ${zoom.view.w} ${zoom.view.h}`;
  const handleSize = Math.max(room.width, room.depth) * 0.022;
  const chairSize = deskUnit(savedRoom) * 0.32;

  const selectedIds = pieceControls?.selected ?? [];
  const pickedSpot = spots?.picked ? savedRoom.seats.find((seat) => seat.id === spots.picked) : undefined;
  const pickedFurniture = furniture?.picked ? savedRoom.pieces.find((piece) => piece.id === furniture.picked) : undefined;
  const anchor: Box | null = pickedFurniture
    ? boundsOf(savedRoom.pieces.filter((piece) => piece.id === pickedFurniture.id || (pickedFurniture.group !== undefined && piece.group === pickedFurniture.group)))
    : pickedSpot
    ? { left: pickedSpot.x, right: pickedSpot.x, top: pickedSpot.y - chairSize / 2, bottom: pickedSpot.y + chairSize / 2 }
    : selectedIds.length > 0
      ? selectionBounds(savedRoom, selectedIds)
      : toolbarAnchor
        ? { left: toolbarAnchor.x, right: toolbarAnchor.x, top: toolbarAnchor.y - chairSize / 2, bottom: toolbarAnchor.y + chairSize / 2 }
        : null;
  const busy = Boolean(grab?.dragging || spin || drag);
  const { toolbarAt, pxPerUnit } = useToolbarPlacement({ svgRef, wrapRef, toolbarRef, hasToolbar: Boolean(toolbar), anchor, busy });


  const startResize = (handle: Handle) => (event: ReactPointerEvent<SVGElement>) => {
    const toRoom = capturePointer(svgRef.current, event);
    if (!toRoom) return;
    event.preventDefault();
    setDrag({ handle, toRoom, width: toFeet(savedRoom.width), depth: toFeet(savedRoom.depth) });
  };

  const moveResize = (event: ReactPointerEvent<SVGElement>) => {
    if (!drag) return;
    const point = roomPoint(drag.toRoom, event);
    const { h, v } = drag.handle;
    const sizeFrom = (side: -1 | 0 | 1, at: number, saved: number, current: number) => {
      if (side === 1) return toFeet(at);
      if (side === -1) return toFeet(saved - at);
      return current;
    };
    setDrag({
      ...drag,
      width: sizeFrom(h, point.x, savedRoom.width, drag.width),
      depth: sizeFrom(v, point.y, savedRoom.depth, drag.depth),
    });
  };

  const endResize = () => {
    if (!drag) return;
    onResize?.({ width: toFeet(room.width), depth: toFeet(room.depth), fromLeft: drag.handle.h === -1, fromTop: drag.handle.v === -1 });
    setDrag(null);
  };

  const startFeature = (id: string, event: ReactPointerEvent<SVGElement>) => {
    const canDrag = id === BOARD_ID ? onBoardWall : isFurniture({ id }) ? furniture : onMoveFeature;
    const toRoom = canDrag ? capturePointer(svgRef.current, event) : null;
    if (!toRoom) return;
    const grabbed = roomPoint(toRoom, event);
    const piece = room.pieces.find((candidate) => candidate.id === id);
    // Furniture keeps where it was grabbed under the pointer instead of jumping to center on it.
    const offset = piece && isFurniture(piece) ? { x: piece.x - (grabbed.x - shiftX), y: piece.y - (grabbed.y - shiftY) } : { x: 0, y: 0 };
    setFeatureDrag({ id, toRoom, point: null, offset, start: { x: event.clientX, y: event.clientY } });
  };

  const moveFeatureDrag = (event: ReactPointerEvent<SVGElement>) => {
    if (!featureDrag) return;
    // A small wiggle of a finger isn't a drag.
    if (!featureDrag.point && !pastStart(featureDrag.start, event)) return;
    const point = roomPoint(featureDrag.toRoom, event);
    setFeatureDrag({ ...featureDrag, point: { x: point.x - shiftX + featureDrag.offset.x, y: point.y - shiftY + featureDrag.offset.y } });
  };

  const endFeatureDrag = () => {
    // A tap on furniture (no drag) picks it up, or puts it down again.
    if (featureDrag && !featureDrag.point && isFurniture({ id: featureDrag.id })) furniture?.onPick?.(furniture.picked === featureDrag.id ? null : featureDrag.id);
    if (featureDrag?.point && featureDrag.id === BOARD_ID) onBoardWall?.(nearestWall(room, featureDrag.point));
    else if (featureDrag?.point) (isFurniture({ id: featureDrag.id }) ? furniture?.onMove : onMoveFeature)?.(featureDrag.id, featureDrag.point);
    setFeatureDrag(null);
  };

  const startSpot = (id: string, event: ReactPointerEvent<SVGElement>) => {
    const toRoom = teacher ? capturePointer(svgRef.current, event) : null;
    if (!toRoom) return;
    setSpotDrag({ id, toRoom, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false });
  };

  const moveSpotDrag = (event: ReactPointerEvent<SVGElement>) => {
    if (!spotDrag) return;
    const moved = spotDrag.moved || pastStart({ x: spotDrag.startX, y: spotDrag.startY }, event);
    if (!moved) return;
    const start = roomPoint(spotDrag.toRoom, { clientX: spotDrag.startX, clientY: spotDrag.startY });
    const now = roomPoint(spotDrag.toRoom, event);
    setSpotDrag({ ...spotDrag, moved: true, dx: now.x - start.x, dy: now.y - start.y });
  };

  const endSpotDrag = () => {
    if (!spotDrag || !teacher) return;
    const spot = savedRoom.spots.find((candidate) => candidate.id === spotDrag.id);
    if (spotDrag.moved && spot) teacher.onMove(spot.id, spot.x + spotDrag.dx, spot.y + spotDrag.dy);
    else teacher.onSelect(teacher.selected === spotDrag.id ? null : spotDrag.id);
    setSpotDrag(null);
  };

  const teacherSpotKey = (id: string, event: ReactKeyboardEvent<SVGElement>) => {
    if (!teacher) return;
    const nudge = NUDGES[event.key];
    const spot = savedRoom.spots.find((candidate) => candidate.id === id);
    if (nudge && spot) teacher.onMove(id, spot.x + nudge[0] * UNITS_PER_FOOT, spot.y + nudge[1] * UNITS_PER_FOOT);
    else if (event.key === 'Enter' || event.key === ' ') teacher.onSelect(teacher.selected === id ? null : id);
    else return;
    event.preventDefault();
  };

  // Only with a mouse or pen and the whole room in view: a finger scrolls the page, and when zoomed in the floor pans.
  const startLasso = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (!pieceControls || !showLayout || zoom.scale > 1 || event.pointerType === 'touch') return;
    if (target.closest('[data-piece], [data-drop-zone], [data-no-pan], [role="button"]')) return;
    const toRoom = capturePointer(svgRef.current, event);
    if (!toRoom) return;
    event.preventDefault();
    setLasso({ toRoom, startX: event.clientX, startY: event.clientY, box: null, ids: [] });
  };

  const moveLasso = (event: ReactPointerEvent<SVGElement>) => {
    if (!lasso || (!lasso.box && !pastStart({ x: lasso.startX, y: lasso.startY }, event))) return;
    const a = roomPoint(lasso.toRoom, { clientX: lasso.startX, clientY: lasso.startY });
    const b = roomPoint(lasso.toRoom, event);
    const box = { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
    setLasso({ ...lasso, box, ids: piecesInBox(savedRoom, box) });
  };

  const endLasso = () => {
    if (lasso?.box) pieceControls?.onSelect(lasso.ids);
    setLasso(null);
  };

  const startGrab = (kind: 'piece' | 'spot') => (id: string, event: ReactPointerEvent<SVGElement>) => {
    const toRoom = capturePointer(svgRef.current, event);
    if (!toRoom) return;
    const ids = kind === 'piece' ? (pieceControls?.dragIdsFor(id) ?? []) : [id];
    setGrab({ kind, id, ids, toRoom, startX: event.clientX, startY: event.clientY, dragging: false, dx: 0, dy: 0, fits: true });
  };

  const moveGrab = (event: ReactPointerEvent<SVGElement>) => {
    if (!grab) return;
    const dragging = grab.dragging || pastStart({ x: grab.startX, y: grab.startY }, event);
    if (!dragging) return;
    const start = roomPoint(grab.toRoom, { clientX: grab.startX, clientY: grab.startY });
    const now = roomPoint(grab.toRoom, event);
    if (grab.kind === 'spot') {
      // Spots move freely (no snapping) and stop at the rug's edge.
      const seat = savedRoom.seats.find((s) => s.id === grab.id);
      const moved = moveSpot(savedRoom, grab.id, now.x - start.x, now.y - start.y).seats.find((s) => s.id === grab.id);
      if (!seat || !moved) return;
      setGrab({ ...grab, dragging: true, dx: moved.x - seat.x, dy: moved.y - seat.y });
      return;
    }
    const rawX = snap(now.x - start.x, event.shiftKey);
    const rawY = snap(now.y - start.y, event.shiftKey);
    const { dx, dy } = clampMove(savedRoom, grab.ids, rawX, rawY);
    setGrab({ ...grab, dragging: true, dx, dy, fits: movedFits(savedRoom, grab.ids, dx, dy) });
  };

  const endGrab = () => {
    if (!grab) return;
    const moved = grab.dx !== 0 || grab.dy !== 0;
    if (grab.kind === 'spot') {
      if (grab.dragging && moved) spots?.onMove(grab.id, grab.dx, grab.dy);
      else if (!grab.dragging) spots?.onPick(spots.picked === grab.id ? null : grab.id);
    } else if (pieceControls) {
      if (grab.dragging && moved) pieceControls.onMove(grab.ids, grab.dx, grab.dy);
      else if (!grab.dragging) pieceControls.onClick(grab.id);
    }
    setGrab(null);
  };

  const spinsFurniture = selectedIds.length === 0 && pickedFurniture !== undefined && furniture !== undefined;
  const spinCenter = selectedIds.length > 0 ? selectionCenter(savedRoom, selectedIds) : spinsFurniture ? { x: pickedFurniture.x, y: pickedFurniture.y } : null;
  const spinBox = selectedIds.length > 0 ? selectionBounds(savedRoom, selectedIds) : spinsFurniture ? anchor : null;
  const spinReach = UNITS_PER_FOOT * 2.5;
  // The turn handle sits to the right of the table, or to its left near the right wall.
  const spinSide = spinBox && spinBox.right + spinReach + UNITS_PER_FOOT > savedRoom.width ? -1 : 1;
  const spinX = spinBox ? (spinSide === 1 ? spinBox.right + spinReach : spinBox.left - spinReach) : 0;
  const spinY = spinCenter?.y ?? 0;

  const pointerAngle = (event: ReactPointerEvent<SVGElement>, toRoom: DOMMatrix, cx: number, cy: number) => {
    const point = roomPoint(toRoom, event);
    return (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI;
  };

  const startSpin = (event: ReactPointerEvent<SVGElement>) => {
    const toRoom = spinCenter ? capturePointer(svgRef.current, event) : null;
    if (!toRoom || !spinCenter) return;
    setSpin({
      ids: selectedIds,
      furnitureId: spinsFurniture ? pickedFurniture.id : undefined,
      toRoom,
      cx: spinCenter.x,
      cy: spinCenter.y,
      from: pointerAngle(event, toRoom, spinCenter.x, spinCenter.y),
      degrees: 0,
    });
  };

  const moveSpin = (event: ReactPointerEvent<SVGElement>) => {
    if (!spin) return;
    const raw = pointerAngle(event, spin.toRoom, spin.cx, spin.cy) - spin.from;
    const degrees = event.shiftKey ? Math.round(raw) : Math.round(raw / TURN_SNAP) * TURN_SNAP;
    setSpin({ ...spin, degrees: ((degrees % 360) + 360) % 360 });
  };

  const endSpin = () => {
    if (!spin) return;
    if (spin.degrees !== 0 && spin.furnitureId) furniture?.onTurn(spin.furnitureId, spin.degrees);
    else if (spin.degrees !== 0) pieceControls?.onTurn(spin.ids, spin.degrees);
    setSpin(null);
  };

  // Enter or Space picks a table up; arrows move it a foot, R turns it, Delete removes it, Esc puts it down.
  const pieceKey = (id: string, event: ReactKeyboardEvent<SVGElement>) => {
    if (!pieceControls) return;
    const picked = pieceControls.selected.includes(id);
    const nudge = NUDGES[event.key];
    if (event.key === 'Enter' || event.key === ' ') pieceControls.onClick(id);
    else if (!picked) return;
    else if (nudge) pieceControls.onMove(pieceControls.selected, nudge[0] * UNITS_PER_FOOT, nudge[1] * UNITS_PER_FOOT);
    else if (event.key === 'r' || event.key === 'R') pieceControls.onTurn(pieceControls.selected, 90);
    else if (event.key === 'Delete' || event.key === 'Backspace') pieceControls.onRemove();
    else if (event.key === 'Escape') pieceControls.onClick(null);
    else return;
    event.preventDefault();
  };

  const spotKey = (id: string, event: ReactKeyboardEvent<SVGElement>) => {
    if (!spots) return;
    const picked = spots.picked === id;
    const nudge = NUDGES[event.key];
    if (event.key === 'Enter' || event.key === ' ') spots.onPick(picked ? null : id);
    else if (!picked) return;
    else if (nudge) spots.onMove(id, nudge[0] * MOVE_SNAP, nudge[1] * MOVE_SNAP);
    else if (event.key === 'Delete' || event.key === 'Backspace') spots.onRemove();
    else if (event.key === 'Escape') spots.onPick(null);
    else return;
    event.preventDefault();
  };

  const handles = HANDLES.map((handle) => ({
    handle,
    key: `${handle.h},${handle.v}`,
    x: ((handle.h + 1) / 2) * room.width,
    y: ((handle.v + 1) / 2) * room.depth,
  }));

  const moving: Moving | undefined =
    grab?.dragging && grab.kind === 'piece'
      ? { ids: new Set(grab.ids), dx: grab.dx, dy: grab.dy, fits: grab.fits }
      : spin
        ? { ids: new Set(spin.ids), dx: 0, dy: 0, turn: { degrees: spin.degrees, cx: spin.cx, cy: spin.cy } }
        : undefined;
  const interactive = Boolean(pieceControls || spots || seatLayer);
  const boardHeight = UNITS_PER_FOOT * 0.8;
  const boardWidth = boardLength(boardRoom);
  const boardHandle = UNITS_PER_FOOT * 0.65;

  return (
    <figure className="flex flex-col items-center gap-2" data-tour="room-drawing">
      {(zoomable || actions) && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 print:hidden" data-keep-selection>
          {zoomable ? (
            <div className="flex items-center rounded-full border-2 border-sage-line bg-card px-1 text-sage-ink" role="group" aria-label="Zoom">
              <button type="button" onClick={zoom.zoomOut} disabled={zoom.scale <= 1} className={ZOOM_BUTTON}>
                <IconMinus className="size-5" aria-hidden />
                <span className="sr-only">Zoom out</span>
              </button>
              <button
                type="button"
                onClick={zoom.reset}
                className="min-w-14 cursor-pointer text-sm font-semibold"
                title="Back to the whole room"
                aria-label={`Show the whole room (now ${Math.round(zoom.scale * 100)}%)`}
              >
                {Math.round(zoom.scale * 100)}%
              </button>
              <button type="button" onClick={zoom.zoomIn} disabled={zoom.scale >= zoom.maxScale} className={ZOOM_BUTTON}>
                <IconPlus className="size-5" aria-hidden />
                <span className="sr-only">Zoom in</span>
              </button>
              {fitBox && (
                <button type="button" onClick={() => zoom.fitTo(fitBox)} className={`${ZOOM_BUTTON} border-l-2 border-sage-line`} title="Zoom to the desks">
                  <IconFocusCentered className="size-5" aria-hidden />
                  <span className="sr-only">Zoom to the desks</span>
                </button>
              )}
            </div>
          ) : (
            <span />
          )}
          {actions}
        </div>
      )}
      <div ref={wrapRef} className="relative flex w-full items-center gap-2">
        {emptyMessage && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center pr-6 text-center text-xl font-semibold text-title" role="status">
            <span className="rounded-2xl bg-card/90 px-4 py-2">{emptyMessage}</span>
          </p>
        )}
        <svg
          ref={svgRef}
          role={interactive ? 'group' : 'img'}
          aria-label={`Your room: ${shapeSummary(room)}, board on the ${frontOf(room)} wall`}
          viewBox={viewBox}
          className={`max-h-[60dvh] min-w-0 flex-1 select-none ${drag ? handleCursor(drag.handle) : zoom.scale > 1 ? 'cursor-move touch-none' : zoomable ? 'touch-pan-x touch-pan-y' : ''}`}
          onPointerDown={(event) => {
            zoom.panHandlers.onPointerDown(event);
            startLasso(event);
          }}
          onDragStart={(event) => event.preventDefault()}
          onPointerMove={(event) => {
            zoom.panHandlers.onPointerMove(event);
            moveGrab(event);
            moveLasso(event);
            moveFeatureDrag(event);
            moveSpotDrag(event);
          }}
          onPointerUp={() => {
            zoom.panHandlers.onPointerUp();
            endGrab();
            endLasso();
            endFeatureDrag();
            endSpotDrag();
          }}
          onPointerCancel={() => {
            zoom.panHandlers.onPointerUp();
            setGrab(null);
            setLasso(null);
            setFeatureDrag(null);
            setSpotDrag(null);
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern id={dotsId} width={dots} height={dots} patternUnits="userSpaceOnUse">
              <circle cx={dots / 2} cy={dots / 2} r={UNITS_PER_FOOT * 0.12} fill="var(--color-field-border)" fillOpacity={0.35} />
            </pattern>
            <pattern id={hatchId} width={dots} height={dots} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={dots} stroke="var(--color-line)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </pattern>
            <clipPath id={clipId}>
              <polygon points={points} />
            </clipPath>
          </defs>

          <g transform={`translate(${shiftX} ${shiftY})`}>
            {/* The missing corner of an L reads as "not my room". */}
            {room.shape === 'l-shape' && <rect x={0} y={0} width={room.width} height={room.depth} fill={`url(#${hatchId})`} />}
            <polygon points={points} fill="var(--color-paper)" />
            <rect x={0} y={0} width={room.width} height={room.depth} fill={`url(#${dotsId})`} clipPath={`url(#${clipId})`} />
            <polygon
              points={points}
              fill="none"
              stroke="var(--color-field-border)"
              strokeWidth={3}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <WallFeaturesLayer
              features={wallFeatures(room)}
              onGrab={onMoveFeature ? startFeature : undefined}
              onKeyMove={onMoveFeature}
              labelSize={UNITS_PER_FOOT * 0.7} />
            {/* The board, on whichever wall is the front; in Shape it can be dragged to another wall. */}
            <g
              transform={`rotate(${board.angle} ${board.x} ${board.y})`}
              aria-hidden
              {...(onBoardWall
                ? {
                    className: 'cursor-grab outline-none active:cursor-grabbing',
                    style: { touchAction: 'none' as const },
                    'data-piece': BOARD_ID,
                    onPointerDown: (event: ReactPointerEvent<SVGElement>) => startFeature(BOARD_ID, event),
                  }
                : { pointerEvents: 'none' })}
            >
              {onBoardWall && <rect x={board.x - boardWidth / 2} y={board.y - boardHeight * 1.5} width={boardWidth} height={boardHeight * 3} fill="transparent" />}
              <rect x={board.x - boardWidth / 2} y={board.y - boardHeight / 2} width={boardWidth} height={boardHeight} rx={boardHeight / 2} fill="var(--color-sage-ink)" />
              <text x={board.x} y={board.y} dominantBaseline="central" textAnchor="middle" fontSize={boardHeight * 0.7} fontWeight={600} fill="var(--color-card)" pointerEvents="none">
                Screen
              </text>
            </g>

            <FurnitureLayer
              furniture={furnitureOf(room)}
              nameOf={(piece) => furnitureName(room, piece)}
              onGrab={furniture ? startFeature : undefined}
              onKeyMove={furniture?.onMove}
              onTurn={furniture?.onTurn}
              onPick={furniture?.onPick}
              picked={furniture?.picked ?? null}
              labelSize={UNITS_PER_FOOT * 0.7}
            />
            <PiecesLayer
              pieces={room.pieces.filter((piece) => !isWallFeature(piece) && !isFurniture(piece) && (showLayout || !isLayoutPiece(piece.id)))}
              seats={showLayout ? room.seats : []}
              chairSize={chairSize}
              problems={problems}
              selected={pieceControls ? new Set(lasso?.box ? lasso.ids : grab?.dragging && grab.kind === 'piece' ? grab.ids : pieceControls.selected) : undefined}
              moving={moving}
              canGrab={isLayoutPiece}
              onGrab={pieceControls ? startGrab('piece') : undefined}
              onPieceKey={pieceKey}
              focusable={pieceControls?.focusable}
              spots={
                spots
                  ? {
                      picked: spots.picked,
                      moving: grab?.dragging && grab.kind === 'spot' ? { id: grab.id, dx: grab.dx, dy: grab.dy } : null,
                      onGrab: startGrab('spot'),
                      onKey: spotKey,
                    }
                  : undefined
              }
            />

            {teacher && (
              <TeacherSpotsLayer spots={room.spots} unit={deskUnit(savedRoom)} clipId={clipId} selected={teacher.selected} onGrab={startSpot} onKey={teacherSpotKey} />
            )}
            <DrawingScale.Provider value={pxPerUnit}>{seatLayer}</DrawingScale.Provider>

            {lasso?.box && (
              <rect
                x={lasso.box.left}
                y={lasso.box.top}
                width={lasso.box.right - lasso.box.left}
                height={lasso.box.bottom - lasso.box.top}
                rx={UNITS_PER_FOOT * 0.2}
                fill="var(--color-sage)"
                fillOpacity={0.12}
                stroke="var(--color-sage)"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            {(pieceControls || spinsFurniture) && spinCenter && spinBox && !grab?.dragging && !featureDrag?.point && (
              <g aria-hidden className="cursor-grab">
                <line
                  x1={spinSide === 1 ? spinBox.right : spinBox.left}
                  y1={spinY}
                  x2={spinX}
                  y2={spinY}
                  stroke="var(--color-sage)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <circle
                  cx={spinX}
                  cy={spinY}
                  r={UNITS_PER_FOOT * 1.6}
                  fill="transparent"
                  // Counts as part of the selection, so a click here doesn't put it down.
                  data-piece="turn-handle"
                  style={{ touchAction: 'none' }}
                  onPointerDown={startSpin}
                  onPointerMove={moveSpin}
                  onPointerUp={endSpin}
                  onPointerCancel={() => setSpin(null)}
                />
                <circle
                  cx={spinX}
                  cy={spinY}
                  r={UNITS_PER_FOOT * 0.9}
                  pointerEvents="none"
                  fill="var(--color-sage)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
                <IconRotateClockwise2
                  x={spinX - UNITS_PER_FOOT * 0.6}
                  y={spinY - UNITS_PER_FOOT * 0.6}
                  width={UNITS_PER_FOOT * 1.2}
                  height={UNITS_PER_FOOT * 1.2}
                  color="var(--color-card)"
                  pointerEvents="none"
                />
                {spin && (
                  <text
                    x={spinX}
                    y={spinY - UNITS_PER_FOOT * 1.4}
                    textAnchor="middle"
                    fontSize={UNITS_PER_FOOT * 1.1}
                    fill="var(--color-sage-ink)"
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {spin.degrees}°
                  </text>
                )}
              </g>
            )}

            {onPickCorner &&
              CORNERS.map((corner) => {
                const [cornerX, cornerY] = cornerPoint(room, corner);
                const x = cornerX + (corner.endsWith('left') ? inset : -inset);
                const y = cornerY + (corner.startsWith('top') ? inset : -inset);
                const missing = room.cutCorner === corner;
                return (
                  // Mouse and touch shortcut; the panel has the same choice as buttons.
                  <circle
                    key={corner}
                    aria-hidden
                    cx={x}
                    cy={y}
                    r={target}
                    data-no-pan
                    onClick={() => onPickCorner(corner)}
                    className="cursor-pointer"
                    fill={missing ? 'var(--color-action)' : 'var(--color-action-soft)'}
                    fillOpacity={missing ? 0.9 : 0.45}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            {onResize &&
              handles.map(({ handle, key, x, y }) => (
                // Mouse and touch; the size steppers do the same from the keyboard.
                <g key={key} aria-hidden className={handleCursor(handle)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={handleSize * 2.4}
                    fill="transparent"
                    data-no-pan
                    style={{ touchAction: 'none' }}
                    onPointerDown={startResize(handle)}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={() => setDrag(null)}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={handleSize}
                    pointerEvents="none"
                    fill="var(--color-card)"
                    stroke="var(--color-sage)"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
            {/* The board's own handle, beside the wall's resize circle so the two never fight. */}
            {onBoardWall && (
              <g
                transform={board.angle ? `rotate(${board.angle} ${board.x} ${board.y})` : undefined}
                role="button"
                tabIndex={0}
                aria-label="Screen. Drag it to another wall, or use the arrow keys"
                className="cursor-grab outline-none active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                data-piece={BOARD_ID}
                onPointerDown={(event) => startFeature(BOARD_ID, event)}
                onKeyDown={(event) => {
                  const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
                  if (!by) return;
                  event.preventDefault();
                  onBoardWall(WALL_ORDER[(WALL_ORDER.indexOf(frontOf(room)) + by + WALL_ORDER.length) % WALL_ORDER.length]);
                }}
              >
                <circle cx={board.x - boardWidth * BOARD_HANDLE_AT} cy={board.y} r={Math.max(boardHandle * 1.6, TOUCH_RADIUS_PX / pxPerUnit)} fill="transparent" />
                <circle className="focus-ring" cx={board.x - boardWidth * BOARD_HANDLE_AT} cy={board.y} r={boardHandle * 1.4} fill="none" vectorEffect="non-scaling-stroke" />
                <circle cx={board.x - boardWidth * BOARD_HANDLE_AT} cy={board.y} r={boardHandle} fill="var(--color-card)" stroke="var(--color-sage)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                <IconArrowsMove
                  x={board.x - boardWidth * BOARD_HANDLE_AT - boardHandle * 0.65}
                  y={board.y - boardHandle * 0.65}
                  width={boardHandle * 1.3}
                  height={boardHandle * 1.3}
                  color="var(--color-sage-ink)"
                  pointerEvents="none"
                />
              </g>
            )}
          </g>
        </svg>
        <span className="shrink-0 text-sm font-medium text-ink-muted [writing-mode:vertical-rl]" aria-hidden>
          {toFeet(room.depth)} ft
        </span>
        {toolbar && toolbarAt && (
          // Clicks in here keep the table picked up (see RoomStep).
          <div
            ref={toolbarRef}
            data-keep-selection
            className={`absolute z-10 max-w-full -translate-x-1/2 print:hidden ${toolbarAt.below ? 'translate-y-3' : '-translate-y-[calc(100%+0.75rem)]'}`}
            style={{ left: toolbarAt.left, top: toolbarAt.top }}
          >
            {toolbar}
          </div>
        )}
      </div>
      <span className="text-sm font-medium text-ink-muted" aria-hidden>
        {toFeet(room.width)} ft
      </span>
    </figure>
  );
}
