import type { SVGProps } from 'react';

type Rug = { x: number; y: number; w: number; h: number; rotation: number; flipH: boolean; shape?: string; sweep?: number };

/**
 * A rug's shape around its middle (0, 0): an oval or circle; a half circle
 * with its straight edge at the front; a wedge with its point at the front.
 */
function rugPath({ w, h, shape, sweep }: Rug): string {
  if (shape === 'semicircle') {
    return `M ${-w / 2} ${-h / 2} L ${w / 2} ${-h / 2} A ${w / 2} ${h} 0 0 1 ${-w / 2} ${-h / 2} Z`;
  }
  if (shape === 'wedge') {
    const degrees = Math.min(sweep ?? 90, 359);
    const half = ((degrees / 2) * Math.PI) / 180;
    const r = h;
    const endX = r * Math.sin(half);
    const endY = -h / 2 + r * Math.cos(half);
    const large = degrees > 180 ? 1 : 0;
    return `M 0 ${-h / 2} L ${endX} ${endY} A ${r} ${r} 0 ${large} 1 ${-endX} ${endY} Z`;
  }
  return `M ${-w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${-w / 2} 0 Z`;
}

/** A shaped rug in place: turned and flipped like the piece. */
export function RugShape({ rug, ...rest }: { rug: Rug } & SVGProps<SVGPathElement>) {
  const flip = rug.flipH ? ' scale(-1 1)' : '';
  return (
    <path
      d={rugPath(rug)}
      {...rest}
      transform={`${rest.transform ?? ''} translate(${rug.x} ${rug.y}) rotate(${rug.rotation})${flip}`.trim()}
    />
  );
}
