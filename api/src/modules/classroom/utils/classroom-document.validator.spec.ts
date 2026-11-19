import { BadRequestException } from '@nestjs/common';

import { parseClassroomDocument } from '@modules/classroom/utils/classroom-document.validator';
import { newClassroomDocument } from '@modules/classroom/utils/new-classroom-document';

function classWithStudents() {
  const doc = newClassroomDocument();
  doc.students = [
    {
      id: 'kelly',
      name: 'Kelly',
      level: 1,
      color: 0,
      needs: { 'fewer-neighbors': 'must' },
      note: 'Talks to anybody',
    },
    { id: 'jim', name: 'Jim', level: null, color: null, needs: {}, note: '' },
  ];
  doc.keepApart = [{ a: 'kelly', b: 'jim' }];
  doc.room.pieces = [
    {
      id: 'd1',
      kind: 'desk',
      x: 100,
      y: 100,
      w: 72,
      h: 50,
      rotation: 180,
      flipH: false,
    },
  ];
  doc.room.seats = [{ id: 's1', furnitureId: 'd1', x: 100, y: 130, facing: 0 }];
  doc.room.labels = { s1: 1 };
  doc.room.handSetLabels = ['s1'];
  doc.seating.assignment = { s1: 'kelly' };
  doc.history = [{ at: new Date(0).toISOString(), assignment: { s1: 'jim' } }];
  return doc;
}

describe('parseClassroomDocument', () => {
  it('keeps a valid class as it is', () => {
    const doc = classWithStudents();
    expect(JSON.parse(JSON.stringify(parseClassroomDocument(doc)))).toEqual(
      doc,
    );
  });

  it('fills in chart styles for classes saved before them, and refuses an unknown one', () => {
    const old = newClassroomDocument() as unknown as {
      chart: Record<string, unknown>;
    };
    delete old.chart.style;
    delete old.chart.showWindows;
    expect(parseClassroomDocument(old).chart).toMatchObject({
      style: 'classroom',
      showWindows: true,
    });
    const odd = newClassroomDocument() as unknown as {
      chart: Record<string, unknown>;
    };
    odd.chart.style = 'neon';
    expect(() => parseClassroomDocument(odd)).toThrow();
  });

  it('accepts a brand-new empty class', () => {
    expect(() => parseClassroomDocument(newClassroomDocument())).not.toThrow();
  });

  it('removes a deleted student from charts, history, pairs and checked-off items', () => {
    const doc = classWithStudents();
    doc.seating.checkedOff = [
      'ones-side-by-side||jim,kelly|s1,s2',
      'no-door|||',
    ];
    doc.students = doc.students.filter((s) => s.id !== 'jim');
    const parsed = parseClassroomDocument(doc);
    expect(parsed.keepApart).toEqual([]);
    expect(parsed.history[0].assignment).toEqual({});
    expect(parsed.seating.checkedOff).toEqual(['no-door|||']);
  });

  it('drops unknown fields and labels for seats that are gone', () => {
    const doc = { ...classWithStudents(), extra: 'x' };
    doc.room.labels = { s1: 2, gone: 1 };
    const parsed = parseClassroomDocument(doc);
    expect(parsed).not.toHaveProperty('extra');
    expect({ ...parsed.room.labels }).toEqual({ s1: 2 });
  });

  it.each([
    [
      'an unsupported version',
      (d: ReturnType<typeof classWithStudents>) => (d.version = 99),
    ],
    [
      'a level of 4',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.students[0].level = 4 as 1),
    ],
    [
      'an unknown need',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.students[0].needs = { 'sit-anywhere': 'must' } as never),
    ],
    [
      'a note over 500 characters',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.students[0].note = 'x'.repeat(501)),
    ],
    [
      'a seat on a missing desk',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.room.seats[0].furnitureId = 'nope'),
    ],
    [
      'a student seated twice',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.seating.assignment = { s1: 'kelly', s2: 'kelly' }),
    ],
    [
      'a seat id that clashes with object built-ins',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.room.seats[0].id = '__proto__'),
    ],
    [
      'three color tags',
      (d: ReturnType<typeof classWithStudents>) => d.colors.tags.pop(),
    ],
    [
      'a layout size of 2',
      (d: ReturnType<typeof classWithStudents>) =>
        (d.room.layout = { id: 'desks-rows', size: 2 }),
    ],
  ])('refuses %s', (_, breakIt) => {
    const doc = classWithStudents();
    doc.seating.assignment = { s1: 'kelly' };
    breakIt(doc);
    if (doc.seating.assignment.s2)
      doc.room.seats.push({
        id: 's2',
        furnitureId: 'd1',
        x: 1,
        y: 1,
        facing: 0,
      });
    expect(() => parseClassroomDocument(doc)).toThrow(BadRequestException);
  });

  it('drops control characters and half emoji from text instead of storing them', () => {
    const doc = classWithStudents();
    doc.students[0].name = 'Kel\u0000ly\uD83D';
    doc.students[0].note = 'Line one\nline two\u0007';
    const parsed = parseClassroomDocument(doc);
    expect(parsed.students[0].name).toBe('Kelly');
    expect(parsed.students[0].note).toBe('Line one\nline two');
  });

  it('keeps layouts the teacher changed, and refuses a broken one', () => {
    const doc = classWithStudents();
    doc.room.savedLayouts = {
      'desks-traditional': {
        size: 1,
        pieces: [doc.room.pieces[0]],
        seats: [{ id: 's9', furnitureId: 'd1', x: 1, y: 1, facing: 0 }],
      },
    };
    expect(
      parseClassroomDocument(doc).room.savedLayouts?.['desks-traditional']
        .seats,
    ).toHaveLength(1);
    doc.room.savedLayouts['desks-traditional'].seats[0].furnitureId = 'gone';
    expect(() => parseClassroomDocument(doc)).toThrow(BadRequestException);
  });

  it('reads a missing names-by-table setting as off, and refuses one that is not true or false', () => {
    const doc = classWithStudents();
    const { showList, ...olderChart } = doc.chart;
    expect(showList).toBe(false);
    expect(
      parseClassroomDocument({ ...doc, chart: olderChart }).chart.showList,
    ).toBe(false);
    expect(() =>
      parseClassroomDocument({
        ...doc,
        chart: { ...doc.chart, showList: 'yes' },
      }),
    ).toThrow(BadRequestException);
  });

  it('keeps the wall the board is on, and refuses one that is not a wall', () => {
    const doc = classWithStudents();
    expect(parseClassroomDocument(doc).room.front).toBeUndefined();
    expect(
      parseClassroomDocument({ ...doc, room: { ...doc.room, front: 'left' } })
        .room.front,
    ).toBe('left');
    expect(() =>
      parseClassroomDocument({
        ...doc,
        room: { ...doc.room, front: 'ceiling' as 'left' },
      }),
    ).toThrow(BadRequestException);
  });
});
