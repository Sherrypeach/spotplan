// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { addFurniture, FURNITURE, furnitureKindsList, furnitureOf, moveFurniture } from '@modules/room/furniture';
import { pieceBox } from '@modules/room/roomGeometry';
import { FurnitureLook } from '@modules/room/FurnitureLayer';
import { emptyDoc } from '@test/classroomDocs';

describe('the manager’s furniture', () => {
  it('adds every kind on the floor, with its own place for the manager', () => {
    let room = emptyDoc().room;
    for (const entry of FURNITURE) room = addFurniture(room, entry.kind);
    const kinds = furnitureOf(room).map((piece) => piece.kind);
    for (const entry of FURNITURE) expect(kinds).toContain(entry.kind);
    for (const piece of furnitureOf(room)) {
      expect(piece.x).toBeGreaterThan(0);
      expect(piece.x).toBeLessThan(room.width);
    }
  });

  it('never puts two pieces on top of each other, adding or moving them', () => {
    let room = emptyDoc().room;
    for (let i = 0; i < 8; i++) room = addFurniture(room, i % 2 ? 'sink' : 'bookshelf');
    const boxes = furnitureOf(room).map(pieceBox);
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1)) expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
    const [first, second] = furnitureOf(room);
    expect(moveFurniture(room, first.id, { x: second.x, y: second.y })).toBe(room);
  });

  it('draws a bookshelf and a sink as themselves, not as a desk with a laptop', () => {
    const screens = (kind: string) => render(<svg><FurnitureLook kind={kind} w={150} h={45} /></svg>).container.querySelectorAll('rect[fill="#2f3a63"]').length;
    expect(screens('teacher-desk')).toBeGreaterThan(0);
    for (const kind of ['bookshelf', 'sink']) expect(screens(kind)).toBe(0);
  });

  it('names only the places a manager spends time in hints', () => {
    expect(furnitureKindsList()).toContain('rug');
    expect(furnitureKindsList()).not.toContain('sink');
  });
});
