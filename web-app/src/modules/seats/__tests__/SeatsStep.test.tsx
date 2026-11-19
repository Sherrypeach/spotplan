// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ClassroomDocument } from '@modules/classroom/document';
import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { placeLayout } from '@modules/room/layoutPlacement';
import { SeatsStep } from '@modules/seats/SeatsStep';
import { PrivacyContext } from '@modules/shell/privacy';
import { docWith, student } from '@test/classroomDocs';
import { LocationProbe } from '@test/LocationProbe';
import { TestClassroom } from '@test/TestClassroom';

const traditional = (library as LayoutLibrary).layouts.find((layout) => layout.id === 'desks-traditional')!;

function classDoc(): ClassroomDocument {
  const doc = docWith(Array.from({ length: 12 }, (_, i) => student(`s${i}`, `Person ${i}`, ([1, 2, 3] as const)[i % 3])));
  return { ...doc, room: placeLayout(doc.room, traditional, 1) };
}

function renderSeats(path = '/seats', initial = classDoc(), hidden = false) {
  const changes = vi.fn<(doc: ClassroomDocument) => void>();
  render(
    <PrivacyContext.Provider value={{ hidden, toggle: () => {} }}>
      <TestClassroom initial={initial} onChange={changes}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/seats" element={<SeatsStep />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </TestClassroom>
    </PrivacyContext.Provider>,
  );
  return { latest: () => changes.mock.calls.at(-1)?.[0] };
}

describe('SeatsStep', () => {
  it('asks for desks first when the room has none', () => {
    renderSeats('/seats', docWith([student('a', 'Ann', 1)]));
    expect(screen.getByRole('link', { name: /Pick a layout first/ })).toBeInTheDocument();
  });

  it('shows suggested labels and changes one with a click', async () => {
    const { latest } = renderSeats();
    expect(screen.getByRole('heading', { name: 'Mark seats 1, 2 and 3' })).toBeInTheDocument();
    const seat = screen.getAllByRole('button', { name: /seat\. Tap to change/ })[0];
    await userEvent.click(seat);
    const menu = screen.getByRole('group', { name: 'Who is this seat for?' });
    const notCurrent = Array.from(menu.querySelectorAll('button')).find((button) => button.getAttribute('aria-pressed') === 'false')!;
    await userEvent.click(notCurrent);
    expect(latest()!.room.handSetLabels).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Who is this seat for?' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to suggestions' }));
    expect(latest()!.room.handSetLabels).toHaveLength(0);
  });

  it('seats the team and reports what to check', async () => {
    const { latest } = renderSeats('/seats?part=students');
    await userEvent.click(screen.getByRole('button', { name: 'Place teammates' }));
    expect(await screen.findByText(/Placed 12 teammates/)).toBeInTheDocument();
    expect(Object.keys(latest()!.seating.assignment)).toHaveLength(12);
    expect(screen.getByText('Everyone has a seat.')).toBeInTheDocument();
    expect(screen.getByText('12 of 12 seated')).toBeInTheDocument();
  });

  it('opens a teammate card to lock or unseat them', async () => {
    const { latest } = renderSeats('/seats?part=students');
    await userEvent.click(screen.getByRole('button', { name: 'Place teammates' }));
    await screen.findByText(/Placed 12 teammates/);
    await userEvent.click(screen.getByRole('button', { name: /^Person 0,/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lock seat' }));
    expect(latest()!.seating.lockedSeats).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Unseat' }));
    expect(Object.values(latest()!.seating.assignment)).not.toContain('s0');
    expect(screen.getByRole('region', { name: 'Unseated' })).toHaveTextContent('Person 0');
  });

  it('lists what to fix in plain sentences and checks items off', async () => {
    const doc = classDoc();
    const { latest } = renderSeats('/seats?part=check', { ...doc, students: [...doc.students, student('new', 'Nora', null)] });
    expect(screen.getByText('Nora doesn’t have a level yet.')).toBeInTheDocument();
    expect(screen.getByLabelText('Summary')).toHaveTextContent(/to fix/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Got it' })[0]);
    expect(latest()!.seating.checkedOff).toHaveLength(1);
  });

  it('moves a picked teammate into an empty seat with a click', async () => {
    const { latest } = renderSeats('/seats?part=students');
    await userEvent.click(screen.getByRole('button', { name: 'Place teammates' }));
    await screen.findByText(/Placed 12 teammates/);
    await userEvent.click(screen.getByRole('button', { name: /^Person 0,/ }));
    const empty = screen.getAllByRole('button', { name: /^Empty seat/ })[0];
    await userEvent.click(empty);
    const seat = Object.keys(latest()!.seating.assignment).find((id) => latest()!.seating.assignment[id] === 's0');
    expect(empty.closest('[data-drop-zone]')).toHaveAttribute('data-drop-zone', `seat:${seat}`);
  });

  it('only says how many were placed while private info is hidden', async () => {
    renderSeats('/seats?part=students', classDoc(), true);
    await userEvent.click(screen.getByRole('button', { name: 'Place teammates' }));
    expect(await screen.findByText('Placed 12 teammates.')).toBeInTheDocument();
    expect(screen.queryByText(/to check/)).not.toBeInTheDocument();
  });
});
