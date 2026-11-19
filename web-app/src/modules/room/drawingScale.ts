import { createContext, useContext } from 'react';

/** Screen pixels per room unit in the drawing, so labels drawn on it can stay readable at any zoom. */
export const DrawingScale = createContext(1);

// A finger needs about this much, in screen pixels, around a thing it can drag.
export const TOUCH_RADIUS_PX = 22;

export function useDrawingScale(): number {
  return useContext(DrawingScale);
}
