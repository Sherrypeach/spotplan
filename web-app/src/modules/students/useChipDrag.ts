import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Where a name can be dropped: the value of a data-drop-zone attribute ("basket", "level-2"…). */
export type DropZone = string;

export type ChipProps = {
  onPointerDown: (event: ReactPointerEvent<Element>) => void;
  onPointerMove: (event: ReactPointerEvent<Element>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (event: React.MouseEvent) => void;
  style: { touchAction?: 'none' };
};

export type DragState = { id: string; name: string; x: number; y: number; over: DropZone | null };

// A mouse drag starts once the pointer moves this far; a tap stays a tap.
const START_DISTANCE = 6;
// On touch screens a drag starts after holding a name this long, so swiping still scrolls the page.
const TOUCH_HOLD_MS = 250;

function zoneAt(x: number, y: number): DropZone | null {
  return document.elementFromPoint(x, y)?.closest('[data-drop-zone]')?.getAttribute('data-drop-zone') ?? null;
}

/**
 * Lets name chips be dragged between drop zones (any element marked with
 * data-drop-zone), with a mouse or a finger. Tapping and
 * the keyboard work as before; dragging is an extra way to do the same.
 */
export function useChipDrag(onDrop: (id: string, zone: DropZone) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<{ id: string; name: string; from: DropZone; startX: number; startY: number; pointerId?: number; moved: boolean; timer?: number } | null>(null);
  // The click that follows a drop must not also toggle the chip.
  const justDropped = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  // The name under the pointer: moved directly, so the screen re-draws only
  // when what's under it changes, not on every move.
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const show = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  // While a finger drags, the page must not scroll under it.
  useEffect(() => {
    if (!drag) return;
    const stopScroll = (event: TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', stopScroll, { passive: false });
    return () => document.removeEventListener('touchmove', stopScroll);
  }, [drag]);

  // Once a drag starts the page follows it, so letting go anywhere ends it, even if
  // the name lost the pointer (it re-drew, or the browser dropped the capture).
  // Only the finger or mouse that started it counts; Escape cancels.
  useEffect(() => {
    if (!drag) return;
    const mine = (event: PointerEvent) => {
      const id = pending.current?.pointerId;
      return id === undefined || event.pointerId === undefined || event.pointerId === id;
    };
    const move = (event: PointerEvent) => {
      const start = pending.current;
      if (!dragRef.current || !start || !mine(event)) return;
      if (Math.hypot(event.clientX - start.startX, event.clientY - start.startY) > START_DISTANCE) start.moved = true;
      const before = dragRef.current;
      const next = { ...before, x: event.clientX, y: event.clientY, over: zoneAt(event.clientX, event.clientY) };
      if (next.over !== before.over || !ghostRef.current) {
        show(next);
        return;
      }
      dragRef.current = next;
      ghostRef.current.style.left = `${next.x}px`;
      ghostRef.current.style.top = `${next.y}px`;
    };
    const up = (event: PointerEvent) => {
      if (mine(event)) end(true);
    };
    const cancel = () => end(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape);
    };
  });

  const begin = (x: number, y: number) => {
    const start = pending.current;
    if (!start) return;
    show({ id: start.id, name: start.name, x, y, over: zoneAt(x, y) });
  };

  const end = (drop: boolean) => {
    const current = dragRef.current;
    const start = pending.current;
    window.clearTimeout(start?.timer);
    pending.current = null;
    show(null);
    if (!current || !start) return;
    // A finger held still and lifted is a slow tap: its click still picks the name.
    justDropped.current = start.moved;
    if (drop && current.over && current.over !== start.from) onDrop(current.id, current.over);
  };

  const chipProps = (id: string, name: string, from: DropZone): ChipProps => ({
    onPointerDown: (event: ReactPointerEvent<Element>) => {
      if (event.button !== 0) return;
      justDropped.current = false;
      const start = { id, name, from, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId, moved: false, timer: undefined as number | undefined };
      pending.current = start;
      if (event.pointerType === 'touch') start.timer = window.setTimeout(() => begin(start.startX, start.startY), TOUCH_HOLD_MS);
    },
    onPointerMove: (event: ReactPointerEvent<Element>) => {
      const start = pending.current;
      if (!start) return;
      // Once dragging, the page's own listener follows the pointer.
      if (dragRef.current) return;
      const moved = Math.hypot(event.clientX - start.startX, event.clientY - start.startY) > START_DISTANCE;
      if (!moved) return;
      if (event.pointerType === 'touch') {
        // Moved before the hold: it's a scroll, not a drag.
        end(false);
        return;
      }
      event.currentTarget.setPointerCapture?.(event.pointerId);
      start.moved = true;
      begin(event.clientX, event.clientY);
    },
    onPointerUp: () => {
      // The page's listener ends a drag; this ends a press that never became one.
      if (!dragRef.current) end(true);
    },
    onPointerCancel: () => end(false),
    onClickCapture: (event: React.MouseEvent) => {
      if (!justDropped.current) return;
      justDropped.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    style: { touchAction: drag?.id === id ? 'none' : undefined },
  });

  return { drag, chipProps, ghostRef };
}
