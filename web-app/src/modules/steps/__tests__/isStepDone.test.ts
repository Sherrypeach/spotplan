import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { placeLayout } from '@modules/room/layoutPlacement';
import { engineRoom, placeAll } from '@modules/seats/seatingModel';
import { isStepDone } from '@modules/steps/steps';
import { docWith, emptyDoc, student } from '@test/classroomDocs';

const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;

describe('isStepDone', () => {
  it('marks a step done only when its work is really done', () => {
    expect(isStepDone('students', emptyDoc())).toBe(false);
    const leveled = docWith([student('a', 'Ann', 1), student('b', 'Bo', 3)]);
    expect(isStepDone('students', leveled)).toBe(true);
    expect(isStepDone('students', docWith([student('a', 'Ann', null)]))).toBe(false);
    expect(isStepDone('room', leveled)).toBe(false);
    const withRoom = { ...leveled, room: placeLayout(leveled.room, traditional, 1) };
    expect(isStepDone('room', withRoom)).toBe(true);
    expect(isStepDone('seats', withRoom)).toBe(false);
    expect(isStepDone('seats', placeAll(withRoom, engineRoom(withRoom.room)))).toBe(true);
    expect(isStepDone('chart', withRoom)).toBe(false);
  });
});
