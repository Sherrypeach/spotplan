// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ChartStep } from '@modules/chart/ChartStep';
import type { ClassroomDocument } from '@modules/classroom/document';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { placeLayout } from '@modules/room/layoutPlacement';
import { engineRoom, placeAll } from '@modules/seats/seatingModel';
import { docWith, student } from '@test/classroomDocs';
import { TestClassroom } from '@test/TestClassroom';

const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;

function seatedClass(): ClassroomDocument {
  const kids = [student('a', 'Avery', 1), student('b', 'Blake', 2), student('c', 'Casey', 3)];
  kids[0].note = 'acts up with an audience';
  kids[0].needs = { 'near-front': 'must' };
  const doc = docWith(kids);
  const withRoom = { ...doc, room: placeLayout(doc.room, traditional, 1) };
  return placeAll(withRoom, engineRoom(withRoom.room));
}

function renderChart(initial = seatedClass()) {
  const changes = vi.fn<(doc: ClassroomDocument) => void>();
  render(
    <TestClassroom initial={initial} onChange={changes}>
      <MemoryRouter>
        <ChartStep />
      </MemoryRouter>
    </TestClassroom>,
  );
  return { latest: () => changes.mock.calls.at(-1)?.[0] };
}

describe('ChartStep', () => {
  it('shows names only: no levels, needs or notes', () => {
    renderChart();
    const sheet = screen.getByRole('img', { name: /Office Seating Chart: 3 teammates/ });
    expect(sheet).toHaveTextContent('Avery');
    expect(sheet).toHaveTextContent('Moving day');
    expect(sheet.outerHTML).not.toMatch(/acts up|near-front|near the front|level|Level/);
  });

  it('changes the title and the directions', async () => {
    const { latest } = renderChart();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Room 12');
    expect(latest()!.chart.title).toBe('Room 12');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show them on the chart' }));
    expect(latest()!.chart.showDirections).toBe(false);
  });

  it('sets the directions and list together from what the chart is for, leaving the room as it is', async () => {
    const { latest } = renderChart();
    await userEvent.click(screen.getByRole('button', { name: 'Door copy' }));
    expect(latest()!.chart).toMatchObject({ showDirections: false, showList: false });
    const view = latest()!.chart.view;
    await userEvent.click(screen.getByRole('button', { name: 'Moving day' }));
    expect(latest()!.chart).toMatchObject({ view, showDirections: true, showList: false });
    expect(screen.getByRole('button', { name: 'Moving day' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves the chart to the past charts list', async () => {
    const { latest } = renderChart();
    await userEvent.click(screen.getByRole('button', { name: 'Save this chart' }));
    expect(latest()!.savedCharts).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('asks to seat the team first when nobody has a seat', () => {
    renderChart(docWith([student('a', 'Avery', 1)]));
    expect(screen.getByRole('link', { name: /Seat your team first/ })).toBeInTheDocument();
  });

  it('asks before restoring or deleting a past chart', async () => {
    const { latest } = renderChart();
    await userEvent.click(screen.getByRole('button', { name: 'Save this chart' }));
    expect(screen.getByRole('status')).toHaveTextContent('Chart saved.');
    await userEvent.click(screen.getByRole('button', { name: /^Delete / }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(latest()!.savedCharts).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /^Delete / }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(latest()!.savedCharts).toHaveLength(0);
  });

  it('presents the chart over the page where full screen isn’t available, with a way back', async () => {
    renderChart();
    await userEvent.click(screen.getByRole('button', { name: 'Present' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('edits the directions step by step', async () => {
    const { latest } = renderChart();
    await userEvent.click(screen.getByRole('button', { name: 'Edit the directions' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Step 1' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Step 1' }), 'Stand up');
    await userEvent.click(screen.getByRole('button', { name: 'Move step 1 down' }));
    expect(latest()!.chart.directions[1]).toBe('Stand up');
    await userEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    expect(latest()!.chart.directions).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Remove step 6' }));
    expect(latest()!.chart.directions).toHaveLength(5);
  });
});
