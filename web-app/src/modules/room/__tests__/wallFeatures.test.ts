import { describe, expect, it } from 'vitest';

import { cutBox } from '@modules/room/roomGeometry';
import { addChair, addFurniture, canAddChair, canAddFurniture, canRejoinChair, rejoinChair, furnitureName, moveFurniture, removeFurniture, splitFurniture } from '@modules/room/furniture';
import { piecesOverlapping } from '@modules/room/layoutPlacement';
import { setRoomFeet, setRoomShape } from '@modules/room/roomEdits';
import { addTeacherSpot, moveTeacherSpot } from '@modules/room/teacherSpots';
import { addFeature, doorSegments, moveFeature, removeFeature, wallFeatures } from '@modules/room/wallFeatures';
import { emptyDoc } from '@test/classroomDocs';

describe('doors and windows', () => {
  it('keeps a door and a window apart at a corner, on different walls', () => {
    let room = addFeature(addFeature(emptyDoc().room, 'door'), 'window');
    const [door, window] = wallFeatures(room);
    room = moveFeature(room, door.id, { x: 0, y: 0 });
    const placedDoor = wallFeatures(room)[0];
    room = moveFeature(room, window.id, { x: 0, y: 0 });
    const placedWindow = wallFeatures(room)[1];
    const apart =
      placedDoor.wall === placedWindow.wall ||
      Math.abs(placedWindow.x - placedDoor.x) + Math.abs(placedWindow.y - placedDoor.y) > Math.min(placedDoor.w, placedWindow.w);
    expect(apart).toBe(true);
  });

  it('never lands on another door, window or the board: it slides to the nearest free stretch', () => {
    let room = addFeature(addFeature(emptyDoc().room, 'door'), 'window');
    const [door, window] = wallFeatures(room);
    room = moveFeature(room, window.id, { x: door.x, y: door.y });
    const moved = wallFeatures(room)[1];
    expect(moved.wall).toBe(door.wall);
    expect(Math.abs(moved.x - door.x)).toBeGreaterThanOrEqual((moved.w + door.w) / 2 - 0.5);
    const onBoard = moveFeature(room, door.id, { x: room.width / 2, y: 0 });
    expect(Math.abs(wallFeatures(onBoard)[0].x - room.width / 2)).toBeGreaterThan(door.w / 2);
  });

  it('adds a door on the back wall and a window on the left wall', () => {
    const room = addFeature(addFeature(emptyDoc().room, 'door'), 'window');
    const [door, window] = wallFeatures(room);
    expect(door).toMatchObject({ kind: 'door', wall: 'bottom' });
    expect(door.y).toBeCloseTo(room.depth - door.h / 2);
    expect(window).toMatchObject({ kind: 'window', wall: 'left', rotation: 90 });
  });

  it('moves to the nearest wall and stays on it when the room grows', () => {
    const doc = emptyDoc();
    doc.room = addFeature(doc.room, 'door');
    const id = wallFeatures(doc.room)[0].id;
    doc.room = moveFeature(doc.room, id, { x: doc.room.width - 5, y: 200 });
    expect(wallFeatures(doc.room)[0]).toMatchObject({ wall: 'right', y: 200 });
    const wider = setRoomFeet(doc, { width: 40 }).room;
    const door = wallFeatures(wider)[0];
    expect(door.x).toBeCloseTo(wider.width - door.h / 2);
  });

  it('gives the seating engine each door as a segment on its wall, and removes cleanly', () => {
    const room = addFeature(emptyDoc().room, 'door');
    const [segment] = doorSegments(room);
    expect(segment.a.y).toBeCloseTo(segment.b.y);
    expect(Math.abs(segment.b.x - segment.a.x)).toBeGreaterThan(0);
    expect(wallFeatures(removeFeature(room, wallFeatures(room)[0].id))).toEqual([]);
  });

  it('stays off the missing corner of an L-shaped room', () => {
    let room = setRoomShape(emptyDoc(), 'l-shape').room;
    const box = cutBox(room)!;
    for (let i = 0; i < 6; i += 1) room = addFeature(room, 'door');
    for (const door of wallFeatures(room)) expect(door.x + door.w / 2).toBeLessThanOrEqual(box.left + 0.001);
    const id = wallFeatures(room)[0].id;
    const moved = wallFeatures(moveFeature(room, id, { x: room.width - 5, y: room.depth - 5 }))[0];
    const inCut = moved.x > box.left && moved.x < box.right && moved.y > box.top && moved.y < box.bottom;
    expect(inCut).toBe(false);
  });
});

describe('manager spots in an L-shaped room', () => {
  it('are pushed out of the missing corner', () => {
    const room = addTeacherSpot(setRoomShape(emptyDoc(), 'l-shape').room);
    const box = cutBox(room)!;
    const spot = moveTeacherSpot(room, room.spots[0].id, (box.left + box.right) / 2, (box.top + box.bottom) / 2).spots[0];
    const inCut = spot.x > box.left && spot.x < box.right && spot.y > box.top && spot.y < box.bottom;
    expect(inCut).toBe(false);
  });
});

describe('furniture', () => {
  it('keeps desks off it: a desk on the manager’s desk counts as overlapping', () => {
    const doc = emptyDoc();
    let room = addFurniture(doc.room, 'teacher-desk');
    const desk = room.pieces[0];
    room = { ...room, pieces: [...room.pieces, { id: 'A-d1', kind: 'desk', x: desk.x, y: desk.y, w: 72, h: 50, rotation: 0, flipH: false }] };
    expect(piecesOverlapping(room)).toContain('A-d1');
  });

  it('stays on the floor and keeps its place for the manager when the room shrinks', () => {
    const doc = emptyDoc();
    doc.room = moveFurniture(addFurniture(doc.room, 'rug'), 'F-rug1', { x: doc.room.width, y: doc.room.depth });
    const smaller = setRoomFeet(doc, { width: 20, depth: 16 }).room;
    const [rug] = smaller.pieces;
    expect(rug.x + rug.w / 2).toBeLessThanOrEqual(smaller.width);
    expect(rug.y + rug.h / 2).toBeLessThanOrEqual(smaller.depth);
    expect(smaller.spots[0]).toMatchObject({ x: rug.x, y: rug.y, pieceId: rug.id });
  });

  it('lands on the floor of a small L-shaped room, numbers two of a kind, and stops at the limit', () => {
    const doc = setRoomShape(emptyDoc(), 'l-shape');
    let room = doc.room;
    for (let i = 0; i < 2; i++) room = addFurniture(room, 'bookshelf');
    const box = cutBox(room)!;
    for (const piece of room.pieces) {
      const inCut = piece.x > box.left && piece.x < box.right && piece.y > box.top && piece.y < box.bottom;
      expect(inCut).toBe(false);
    }
    expect(room.pieces.map((piece) => furnitureName(room, piece))).toEqual(['Shelves 1', 'Shelves 2']);
    expect(room.pieces[0]).not.toMatchObject({ x: room.pieces[1].x, y: room.pieces[1].y });
    const full = { ...room, spots: Array.from({ length: 15 }, (_, i) => ({ id: `spot${i}`, x: 100, y: 100, time: 'most' as const })) };
    expect(canAddFurniture(full)).toBe(false);
    expect(addFurniture(full, 'rug')).toBe(full);
  });

  it('can stand against a wall, with its chair still behind it', () => {
    let room = addFurniture(emptyDoc().room, 'teacher-desk');
    const gap = room.pieces[0].y - room.pieces[1].y;
    room = moveFurniture(room, room.pieces[0].id, { x: room.width / 2, y: 0 });
    const [desk, chair] = room.pieces;
    expect(chair.y - chair.h / 2).toBeLessThan(10);
    expect(desk.y - chair.y).toBeCloseTo(gap, 0);
  });

  it('puts a pulled-out chair back under My desk, from either one', () => {
    let room = addFurniture(emptyDoc().room, 'teacher-desk');
    const [desk, chair] = room.pieces;
    room = splitFurniture(room, desk.id);
    expect(room.pieces[1].group).toBeUndefined();
    expect(canRejoinChair(room, room.pieces[1])).toBe(true);
    const back = rejoinChair(room, chair.id);
    expect(back.pieces.map((piece) => piece.kind).sort()).toEqual(['teacher-chair', 'teacher-desk']);
    expect(back.pieces.every((piece) => piece.group === desk.id)).toBe(true);
    expect(rejoinChair(room, desk.id).pieces.find((piece) => piece.id === chair.id)?.group).toBe(desk.id);
  });

  it('gives My desk its chair back once it lost it', () => {
    let room = addFurniture(emptyDoc().room, 'teacher-desk');
    const [desk, chair] = room.pieces;
    room = splitFurniture(room, desk.id);
    room = removeFurniture(room, chair.id);
    expect(canAddChair(room, room.pieces[0])).toBe(true);
    room = addChair(room, desk.id);
    expect(room.pieces.map((piece) => piece.kind)).toEqual(['teacher-desk', 'teacher-chair']);
    expect(room.pieces[1].group).toBe(room.pieces[0].group);
    expect(canAddChair(room, room.pieces[0])).toBe(false);
  });

  it('brings My desk with its chair joined: they move and turn together until split', () => {
    let room = addFurniture(emptyDoc().room, 'teacher-desk');
    const [desk, chair] = room.pieces;
    expect(chair).toMatchObject({ kind: 'teacher-chair', group: desk.id });
    expect(chair.y).toBeLessThan(desk.y);
    room = moveFurniture(room, desk.id, { x: desk.x - 100, y: desk.y });
    expect(room.pieces[1].x).toBeCloseTo(chair.x - 100);
    room = splitFurniture(room, desk.id);
    expect(room.pieces.every((piece) => piece.group === undefined)).toBe(true);
    const before = room.pieces[1];
    room = moveFurniture(room, room.pieces[0].id, { x: room.pieces[0].x + 100, y: room.pieces[0].y });
    expect(room.pieces[1]).toEqual(before);
    expect(removeFurniture(addFurniture(emptyDoc().room, 'teacher-desk'), 'F-teacher-desk1').pieces).toEqual([]);
  });
});
