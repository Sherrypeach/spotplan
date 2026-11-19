import { useEffect, useRef } from 'react';

// A press that moves farther than this (in pixels) is a scroll or a pan, not a tap.
const TAP_SLOP_PX = 10;

/**
 * Calls `onOutside` when the page is tapped or clicked anywhere outside the
 * elements matching `keep`. Uses pointer events rather than click, so it also
 * works on iPad, and a scroll or a pan never counts as a tap.
 */
export function useOutsideTap(active: boolean, keep: string, onOutside: () => void): void {
  const callback = useRef(onOutside);
  useEffect(() => {
    callback.current = onOutside;
  });

  useEffect(() => {
    if (!active) return;
    let start: { x: number; y: number } | null = null;
    const isKept = (event: PointerEvent) => Boolean((event.target as Element | null)?.closest?.(keep));
    const down = (event: PointerEvent) => {
      start = isKept(event) ? null : { x: event.clientX, y: event.clientY };
    };
    const up = (event: PointerEvent) => {
      const from = start;
      start = null;
      if (!from || isKept(event) || Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP_PX) return;
      callback.current();
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
    };
  }, [active, keep]);
}
