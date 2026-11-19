import { describe, expect, it } from 'vitest';

import { placeBubble } from '@modules/tour/placeBubble';

const screen = { width: 1200, height: 800 };
const bubble = { width: 340, height: 200 };

describe('where the tour bubble goes', () => {
  it('sits below a part when it fits, centered on it', () => {
    expect(placeBubble({ top: 100, left: 400, width: 200, height: 100 }, screen, bubble)).toEqual({ top: 220, left: 330 });
  });

  it('goes above a part low on the screen', () => {
    expect(placeBubble({ top: 600, left: 400, width: 200, height: 100 }, screen, bubble)!.top).toBe(600 - 8 - 12 - 200);
  });

  it('goes beside a part too tall for above or below, like the room drawing', () => {
    expect(placeBubble({ top: 20, left: 0, width: 80, height: 760 }, screen, bubble)).toEqual({ top: 20, left: 100 });
  });

  it('stays on screen, and is centered when there is no part', () => {
    expect(placeBubble({ top: 100, left: 1150, width: 40, height: 40 }, screen, bubble)!.left).toBe(1200 - 340 - 12);
    expect(placeBubble(null, screen, bubble)).toBeNull();
  });
});
