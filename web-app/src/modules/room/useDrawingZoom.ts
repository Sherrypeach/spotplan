import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import type { Box } from '@modules/room/roomGeometry';

/** The part of the room the drawing shows, in room units. */
type View = { x: number; y: number; w: number; h: number };

const MAX_SCALE = 5;
const STEP = 1.5;
const WHEEL_STEP = 1.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Zoom and pan for a drawing: buttons zoom in and out around the middle,
 * the mouse wheel (or a trackpad pinch) zooms around the pointer, two fingers
 * pinch on a tablet, and dragging the empty floor moves around while zoomed in.
 */
export function useDrawingZoom(base: View, enabled: boolean, svgRef: RefObject<SVGSVGElement | null>, frozen = false) {
  const [zoom, setZoom] = useState<{ scale: number; cx: number; cy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; cx: number; cy: number; perPixel: number } | null>(null);
  const lastView = useRef(base);

  const active = enabled && zoom !== null && zoom.scale > 1;
  const w = active ? base.w / zoom.scale : base.w;
  const h = active ? base.h / zoom.scale : base.h;
  const zoomedView: View = active
    ? { x: clamp(zoom.cx - w / 2, base.x, base.x + base.w - w), y: clamp(zoom.cy - h / 2, base.y, base.y + base.h - h), w, h }
    : base;
  // While a wall is dragged the view holds still, so the wall stays under the pointer.
  const view = frozen && active ? lastView.current : zoomedView;
  useEffect(() => {
    lastView.current = view;
  });
  const center = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  const scale = active ? zoom.scale : 1;

  const zoomBy = (factor: number, around = center) => {
    const next = clamp(scale * factor, 1, MAX_SCALE);
    if (next === 1) return setZoom(null);
    const kept = scale / next;
    setZoom({ scale: next, cx: around.x + (center.x - around.x) * kept, cy: around.y + (center.y - around.y) * kept });
  };

  const fitTo = (box: Box) => {
    const next = clamp(Math.min(base.w / (box.right - box.left), base.h / (box.bottom - box.top)), 1, MAX_SCALE);
    setZoom(next === 1 ? null : { scale: next, cx: (box.left + box.right) / 2, cy: (box.top + box.bottom) / 2 });
  };

  // The mouse wheel and trackpad pinches zoom around the pointer, and stop at
  // the whole room instead of scrolling the page.
  const zoomRef = useRef(zoomBy);
  const scaleRef = useRef(scale);
  useEffect(() => {
    zoomRef.current = zoomBy;
    scaleRef.current = scale;
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!enabled || !svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY === 0) return;
      const zoomingOut = event.deltaY > 0;
      if (zoomingOut && scaleRef.current <= 1) return;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      zoomRef.current(zoomingOut ? 1 / WHEEL_STEP : WHEEL_STEP, { x: point.x, y: point.y });
    };
    // Two fingers on a tablet: spreading them zooms in around the point between them.
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number } | null = null;
    const spread = () => {
      const [a, b] = [...fingers.values()];
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size !== 2) return;
      // The second finger starts a pinch: it doesn't also pick up what's under it.
      event.stopPropagation();
      pinch = { distance: spread().distance };
    };
    const move = (event: PointerEvent) => {
      if (!fingers.has(event.pointerId)) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinch || fingers.size !== 2) return;
      const now = spread();
      const matrix = svg.getScreenCTM();
      if (!matrix || pinch.distance === 0) return;
      const factor = now.distance / pinch.distance;
      if (Math.abs(factor - 1) < 0.02) return;
      const point = new DOMPoint(now.x, now.y).matrixTransform(matrix.inverse());
      pinch = { distance: now.distance };
      zoomRef.current(factor, { x: point.x, y: point.y });
    };
    const up = (event: PointerEvent) => {
      fingers.delete(event.pointerId);
      if (fingers.size < 2) pinch = null;
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [enabled, svgRef]);

  const panHandlers = {
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => {
      const target = event.target as Element;
      if (!active || event.button !== 0 || target.closest('[data-piece], [data-drop-zone], [data-no-pan], [role="button"]')) return;
      // Panning, not dragging: the browser must not start its own drag or select text.
      event.preventDefault();
      const scaleOnScreen = event.currentTarget.getScreenCTM()?.a ?? 0;
      pan.current = { x: event.clientX, y: event.clientY, cx: center.x, cy: center.y, perPixel: scaleOnScreen > 0 ? 1 / scaleOnScreen : 1 };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => {
      const start = pan.current;
      if (!start || !zoom) return;
      if (event.buttons === 0) {
        pan.current = null;
        return;
      }
      const cx = start.cx - (event.clientX - start.x) * start.perPixel;
      const cy = start.cy - (event.clientY - start.y) * start.perPixel;
      setZoom({ ...zoom, cx: clamp(cx, base.x + w / 2, base.x + base.w - w / 2), cy: clamp(cy, base.y + h / 2, base.y + base.h - h / 2) });
    },
    onPointerUp: () => {
      pan.current = null;
    },
  };

  return {
    view,
    scale,
    maxScale: MAX_SCALE,
    zoomIn: () => zoomBy(STEP),
    zoomOut: () => zoomBy(1 / STEP),
    fitTo,
    reset: () => setZoom(null),
    panHandlers,
  };
}
