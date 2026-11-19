import { describe, expect, it } from 'vitest';

import type { DocRoom } from '@modules/classroom/document';
import { boardPlace, fromFrontUp, toFrontUp } from '@modules/room/frontFrame';
import { emptyDoc } from '@test/classroomDocs';

function roomWith(front: DocRoom['front']): DocRoom {
  return {
    ...emptyDoc().room,
    width: 1000,
    depth: 600,
    front,
    pieces: [{ id: 'A-d1', kind: 'desk', x: 100, y: 50, w: 72, h: 50, rotation: 0, flipH: false }],
    seats: [{ id: 'A-d1s', furnitureId: 'A-d1', x: 100, y: 80, facing: 0 }],
    spots: [{ id: 'spot1', x: 950, y: 300, time: 'most' }],
  };
}

describe('the room seen with the board at the top', () => {
  it('puts the board wall at the top and turns everything back the same way', () => {
    for (const front of ['top', 'right', 'bottom', 'left'] as const) {
      const room = roomWith(front);
      const up = toFrontUp(room);
      expect(up.front ?? 'top').toBe('top');
      const back = fromFrontUp(up, front);
      expect(back.width).toBe(room.width);
      expect(back.pieces[0]).toMatchObject({ x: 100, y: 50 });
      expect(back.seats[0].facing % 360).toBe(0);
      expect(back.spots[0]).toMatchObject({ x: 950, y: 300 });
    }
  });

  it('brings a spot by the right wall to the top when the board is on the right', () => {
    const up = toFrontUp(roomWith('right'));
    expect(up.width).toBe(600);
    expect(up.spots[0].y).toBe(50);
  });

  it('hangs the board in the middle of its wall', () => {
    expect(boardPlace(roomWith('top'))).toMatchObject({ x: 500, y: 0, angle: 0 });
    expect(boardPlace(roomWith('right'))).toMatchObject({ x: 1000, y: 300, angle: 90 });
    expect(boardPlace(roomWith('bottom'))).toMatchObject({ x: 500, y: 600, angle: 0 });
    expect(boardPlace(roomWith('left'))).toMatchObject({ x: 0, y: 300, angle: 90 });
  });
});

describe('an L-shaped room seen with the board on the right', () => {
  it('turns its missing corner too, and comes back unchanged', () => {
    const room: DocRoom = { ...roomWith('right'), shape: 'l-shape', cutCorner: 'bottom-left', cutWidth: 300, cutDepth: 200 };
    const up = toFrontUp(room);
    expect(up.cutCorner).toBe('bottom-right');
    expect(up).toMatchObject({ cutWidth: 200, cutDepth: 300 });
    expect(fromFrontUp(up, 'right')).toMatchObject({ cutCorner: 'bottom-left', cutWidth: 300, cutDepth: 200, width: 1000, depth: 600 });
  });

  it('hangs the board off center when the front wall is cut', () => {
    const room: DocRoom = { ...roomWith('top'), shape: 'l-shape', cutCorner: 'top-left', cutWidth: 400, cutDepth: 200 };
    expect(boardPlace(room).x).toBe(700);
  });
});
