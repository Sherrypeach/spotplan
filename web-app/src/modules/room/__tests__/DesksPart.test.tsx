// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { DesksPart } from '@modules/room/DesksPart';
import { chooseLayout, placeLayout } from '@modules/room/layoutPlacement';
import { docWith, student } from '@test/classroomDocs';
import { TestClassroom } from '@test/TestClassroom';

const lib = library as LayoutLibrary;
const traditional = lib.layouts.find((layout) => layout.id === 'desks-traditional')!;

const kids = Array.from({ length: 30 }, (_, index) => student(`s${index}`, `Person ${index}`, 2));

function renderDesks(previewing?: string) {
  const doc = docWith(kids.slice(0, 2));
  const room = placeLayout(doc.room, traditional, 1);
  const layout = lib.layouts.find((candidate) => candidate.id === previewing);
  const onPreview = vi.fn();
  const changes = vi.fn();
  render(
    <TestClassroom initial={{ ...doc, students: previewing ? kids : doc.students, room }} onChange={changes}>
      <MemoryRouter>
        <DesksPart
          library={lib}
          outsideWalls={0}
          overlapping={0}
          kind="desks"
          onKind={() => {}}
          preview={layout ? { layout, room: chooseLayout(room, layout, traditional), problems: 0 } : null}
          onPreview={onPreview}
        />
      </MemoryRouter>
    </TestClassroom>,
  );
  return { onPreview, latest: () => changes.mock.calls.at(-1)?.[0] };
}

describe('DesksPart', () => {
  it('narrows the layouts with the I want chips', async () => {
    renderDesks();
    const chip = screen.getByRole('button', { name: 'Long, narrow offices' });
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: /2 layouts with long, narrow offices/ })).toBeInTheDocument();
    await userEvent.click(chip);
    expect(screen.getByRole('heading', { name: /Good fits for 2 teammates/ })).toBeInTheDocument();
  });

  it('shows the current layout’s pros and cons', async () => {
    renderDesks();
    await userEvent.click(screen.getByText('Pros and cons of Individual desks'));
    const pros = screen.getByRole('heading', { name: 'Pros' }).parentElement!;
    expect(within(pros).getByText('Everyone faces the screen')).toBeVisible();
    expect(screen.getByText('Hard to collaborate without moving')).toBeVisible();
  });

  it('opens a layout to try it before using it', async () => {
    const { onPreview } = renderDesks();
    const other = screen.getAllByRole('button', { pressed: false }).find((button) => button.querySelector('svg'))!;
    await userEvent.click(other);
    expect(onPreview).toHaveBeenCalledWith(expect.any(String));
  });

  it('uses the previewed layout with the seats the team is missing', async () => {
    const { latest } = renderDesks('desks-banquet');
    const preview = lib.layouts.find((layout) => layout.id === 'desks-banquet')!;
    const short = kids.length - preview.seats.length;
    expect(screen.getByText(new RegExp(`your team has 30 · ${short} short`))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`Use this layout \\+ add ${short} seats`) }));
    expect(latest().room.layout.id).toBe('desks-banquet');
    expect(latest().room.seats.length).toBeGreaterThan(preview.seats.length);
  });
});
