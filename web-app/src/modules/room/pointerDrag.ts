import type { PointerEvent as ReactPointerEvent } from 'react';

// A press becomes a drag once the pointer moves this far (in screen pixels).
export const DRAG_START_PX = 6;

/**
 * Starts following a press on the drawing: the pointer stays with the element
 * until it's let go. Returns the screen-to-room conversion, or null for any
 * button but the main one (or before the drawing has a size).
 */
export function capturePointer(svg: SVGSVGElement | null, event: ReactPointerEvent<SVGElement>): DOMMatrix | null {
  const matrix = svg?.getScreenCTM();
  if (!matrix || event.button !== 0) return null;
  event.stopPropagation();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  return matrix.inverse();
}

/** Where the pointer is, in room units. */
export function roomPoint(toRoom: DOMMatrix, event: { clientX: number; clientY: number }): DOMPoint {
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(toRoom);
}

/** Whether the pointer has moved far enough from where it was pressed to count as a drag. */
export function pastStart(start: { x: number; y: number }, event: { clientX: number; clientY: number }): boolean {
  return Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_START_PX;
}
