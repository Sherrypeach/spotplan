export type Box = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

// Room around the lit-up part, and the gap to the bubble and to the screen's edge, in pixels.
export const HALO = 8;
export const GAP = 12;

/**
 * Where the bubble goes beside the lit-up part: below it if it fits, else
 * above, else to its right or left (a tall part, like the room drawing).
 * Null when it should sit in the middle (no part found).
 */
export function placeBubble(box: Box | null, screen: Size, bubble: Size): { top: number; left: number } | null {
  if (!box) return null;
  const clampLeft = (left: number) => Math.min(Math.max(GAP, left), screen.width - bubble.width - GAP);
  const clampTop = (top: number) => Math.min(Math.max(GAP, top), screen.height - bubble.height - GAP);
  const below = box.top + box.height + HALO + GAP;
  if (below + bubble.height <= screen.height - GAP) return { top: below, left: clampLeft(box.left + box.width / 2 - bubble.width / 2) };
  const above = box.top - HALO - GAP - bubble.height;
  if (above >= GAP) return { top: above, left: clampLeft(box.left + box.width / 2 - bubble.width / 2) };
  const right = box.left + box.width + HALO + GAP;
  if (right + bubble.width <= screen.width - GAP) return { top: clampTop(box.top), left: right };
  const left = box.left - HALO - GAP - bubble.width;
  if (left >= GAP) return { top: clampTop(box.top), left };
  return { top: clampTop(screen.height - bubble.height), left: clampLeft(box.left) };
}

