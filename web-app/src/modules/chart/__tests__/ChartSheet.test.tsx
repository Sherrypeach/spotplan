// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sheetTables } from '@modules/chart/chartModel';
import { ChartSheet } from '@modules/chart/ChartSheet';
import { layoutSheet } from '@modules/chart/sheetLayout';
import type { ClassroomDocument } from '@modules/classroom/document';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { addFurniture } from '@modules/room/furniture';
import { placeLayout } from '@modules/room/layoutPlacement';
import { engineRoom, placeAll } from '@modules/seats/seatingModel';
import { docWith, student } from '@test/classroomDocs';

const pods = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-pods-of-5')!;

function podsClass(): ClassroomDocument {
  const doc = docWith(Array.from({ length: 25 }, (_, i) => student(`s${i}`, `Person Number${i}`, 3)));
  const withRoom = { ...doc, room: placeLayout(doc.room, pods, 1) };
  return placeAll(withRoom, engineRoom(withRoom.room));
}

describe('the chart sheet', () => {
  it('numbers each pod once, front to back, with every teammate at one table', () => {
    const tables = sheetTables(podsClass());
    expect(tables.map((table) => table.number)).toEqual([1, 2, 3, 4, 5]);
    expect(tables.reduce((sum, table) => sum + table.seats.length, 0)).toBe(25);
    for (let i = 1; i < tables.length; i++) expect(tables[i].y >= tables[i - 1].y - 1 || tables[i].x > tables[i - 1].x).toBe(true);
  });

  it('writes each teammate’s first name on their desk when the team uses first names only', () => {
    const doc = podsClass();
    doc.settings = { ...doc.settings, firstNamesOnly: true };
    doc.students = doc.students.map((student, i) => ({ ...student, name: `Person${i} Smith` }));
    const { container } = render(<ChartSheet doc={doc} />);
    const text = container.textContent ?? '';
    for (let i = 0; i < 25; i++) expect(text).toContain(`Person${i}`);
    expect(text).not.toContain('Smith');
  });

  it('keeps first names only in the names-by-table list too', () => {
    const doc = podsClass();
    doc.settings = { ...doc.settings, firstNamesOnly: true };
    doc.chart = { ...doc.chart, showList: true };
    doc.students = doc.students.map((student, i) => ({ ...student, name: `Person${i} Smith` }));
    const { container } = render(<ChartSheet doc={doc} />);
    expect(container.textContent).not.toContain('Smith');
  });

  it('writes every name in full, all at one size, with no two stickers on top of each other', () => {
    const layout = layoutSheet(podsClass());
    expect(layout.tags).toHaveLength(25);
    for (const tag of layout.tags) {
      expect(tag.lines.join(' ')).toBe(tag.name);
      expect(tag.lines.join('')).not.toContain('…');
    }
    const flat = layout.tags.filter((tag) => tag.angle === 0);
    for (const [i, a] of flat.entries())
      for (const b of flat.slice(i + 1)) expect(Math.abs(a.x - b.x) * 2 >= a.width + b.width || Math.abs(a.y - b.y) * 2 >= a.height + b.height).toBe(true);
  });

  it('shows full names when the team doesn’t use first names only', () => {
    const doc = podsClass();
    doc.settings = { ...doc.settings, firstNamesOnly: false };
    doc.students = doc.students.map((student, i) => ({ ...student, name: `K${i} Li` }));
    expect(layoutSheet(doc).tags.map((tag) => tag.name)).toContain('K0 Li');
  });

  it('adds the list of names by table only when asked, beside or under the room', () => {
    const doc = podsClass();
    expect(layoutSheet(doc).list).toBeNull();
    const withList = { ...doc, chart: { ...doc.chart, showList: true } };
    const layout = layoutSheet(withList);
    expect(layout.list?.blocks.map((block) => block.number)).toEqual([1, 2, 3, 4, 5]);
    expect(layout.badges).toHaveLength(5);
    const listed = layout.list!.blocks.flatMap((block) => block.names.map((line) => line.text)).join(' ');
    for (let i = 0; i < 25; i++) expect(listed).toContain(`Number${i}`);
  });

  it('draws the whole room, every desk where it really is', () => {
    const doc = podsClass();
    const layout = layoutSheet(doc);
    expect(layout.drawing.area.left).toBeLessThan(0);
    expect(layout.drawing.area.right).toBeGreaterThan(doc.room.width);
  });

  it('turns the room so the board is at the top, wherever it hangs', () => {
    const doc = podsClass();
    doc.room = { ...doc.room, front: 'bottom' };
    const layout = layoutSheet(doc);
    expect(layout.board.y).toBeLessThan(layout.drawing.y + layout.drawing.height / 4);
  });
});

describe('moving day', () => {
  it('numbers the five starting steps on their card, every word kept', () => {
    const layout = layoutSheet(podsClass());
    expect(layout.directions?.rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5]);
    const words = layout.directions!.rows[1].lines.map((line) => line.text).join(' ');
    expect(words).toBe('Label your bag or box with your name.');
  });

  it('leaves the card off when the directions are off', () => {
    const doc = podsClass();
    expect(layoutSheet({ ...doc, chart: { ...doc.chart, showDirections: false } }).directions).toBeNull();
  });
});

describe('chart styles and what shows', () => {
  it('paints the sheet in the chosen style', () => {
    const doc = podsClass();
    const background = (style: ClassroomDocument['chart']['style']) =>
      render(<ChartSheet doc={{ ...doc, chart: { ...doc.chart, style } }} />).container.querySelector('svg > rect')?.getAttribute('fill');
    expect(background('classroom')).toBe('#fdfcf8');
    expect(background('chalk')).toBe('#24372f');
  });

  it('leaves the manager’s furniture off when asked', () => {
    const doc = podsClass();
    doc.room = addFurniture(doc.room, 'teacher-desk');
    doc.chart = { ...doc.chart, view: 'room' };
    expect(render(<ChartSheet doc={doc} />).container.textContent).toContain('My desk');
    const off = { ...doc, chart: { ...doc.chart, showFurniture: false } };
    expect(render(<ChartSheet doc={off} />).container.textContent).not.toContain('My desk');
  });
});
