import { useLayoutEffect, useState, type RefObject } from 'react';

import type { Box } from '@modules/room/roomGeometry';

// The floating toolbar's size before it's first measured (screen pixels).
const TOOLBAR_HEIGHT_PX = 64;
const TOOLBAR_WIDTH_PX = 300;
// The gap between the toolbar and what it's about.
const TOOLBAR_GAP_PX = 12;

type Options = {
  svgRef: RefObject<SVGSVGElement | null>;
  wrapRef: RefObject<HTMLDivElement | null>;
  toolbarRef: RefObject<HTMLDivElement | null>;
  hasToolbar: boolean;
  /** What the toolbar belongs to, in room units. */
  anchor: Box | null;
  /** Something is being dragged. */
  busy: boolean;
};

/**
 * Where the floating toolbar goes over the drawing (above what's picked, or
 * below it near the top edge), and how many screen pixels one room unit is.
 */
export function useToolbarPlacement({ svgRef, wrapRef, toolbarRef, hasToolbar, anchor, busy }: Options) {
  const [toolbarAt, setToolbarAt] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  useLayoutEffect(() => {
    const place = () => {
      // While something is dragged the toolbar is hidden and the scale can't change: nothing to measure.
      if (busy) {
        setToolbarAt((current) => (current === null ? current : null));
        return;
      }
      const svg = svgRef.current;
      const wrap = wrapRef.current;
      const matrix = svg?.getScreenCTM?.();
      if (matrix && matrix.a > 0) {
        const next = Math.round(matrix.a * 1000) / 1000;
        // Tiny changes are ignored, so measuring can never start a loop of re-draws.
        setPxPerUnit((current) => (Math.abs(current - next) / next < 0.01 ? current : next));
      }
      if (!hasToolbar || !anchor || !svg || !wrap) {
        setToolbarAt((current) => (current === null ? current : null));
        return;
      }
      // No layout to measure (tests): keep the toolbar at the top.
      if (!matrix) {
        setToolbarAt((current) => current ?? { left: 0, top: 0, below: true });
        return;
      }
      const box = wrap.getBoundingClientRect();
      const middle = (anchor.left + anchor.right) / 2;
      const topPoint = new DOMPoint(middle, anchor.top).matrixTransform(matrix);
      const bottomPoint = new DOMPoint(middle, anchor.bottom).matrixTransform(matrix);
      const toolbarHeight = toolbarRef.current?.offsetHeight ?? TOOLBAR_HEIGHT_PX;
      const half = (toolbarRef.current?.offsetWidth ?? TOOLBAR_WIDTH_PX) / 2;
      const below = topPoint.y - box.top < toolbarHeight + TOOLBAR_GAP_PX;
      const x = topPoint.x - box.left;
      const next = {
        left: Math.round(box.width > half * 2 ? Math.min(Math.max(x, half), box.width - half) : box.width / 2),
        top: Math.round((below ? bottomPoint.y : topPoint.y) - box.top),
        below,
      };
      setToolbarAt((current) =>
        current && Math.abs(current.left - next.left) <= 1 && Math.abs(current.top - next.top) <= 1 && current.below === next.below ? current : next,
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  return { toolbarAt, pxPerUnit };
}
