// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ClassroomDocument } from '@modules/classroom/document';
import { PrivacyContext } from '@modules/shell/privacy';
import { StudentsStep } from '@modules/students/StudentsStep';
import { docWith, emptyDoc, student } from '@test/classroomDocs';
import { TestClassroom } from '@test/TestClassroom';
import { LocationProbe } from '@test/LocationProbe';

function renderStep(initial: ClassroomDocument, path = '/students', options: { hidden?: boolean; state?: unknown } = {}) {
  const changes = vi.fn<(doc: ClassroomDocument) => void>();
  render(
    <PrivacyContext.Provider value={{ hidden: options.hidden ?? false, toggle: () => {} }}>
      <TestClassroom initial={initial} onChange={changes}>
        <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.split('?')[1] ? `?${path.split('?')[1]}` : '', state: options.state }]}>
          <Routes>
            <Route path="/students" element={<StudentsStep />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </TestClassroom>
    </PrivacyContext.Provider>,
  );
  const latest = () => changes.mock.calls.at(-1)?.[0];
  return { latest };
}

const levelsOf = (doc: ClassroomDocument | undefined) =>
  Object.fromEntries((doc?.students ?? []).map((s) => [s.name, s.level]));

describe('StudentsStep', () => {
  it('walks a new team through names, the 1s, the 3s, then the baskets', async () => {
    const { latest } = renderStep(emptyDoc());
    expect(screen.getByRole('heading', { name: 'Add your teammates' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Names, one on each line'), 'Ava{Enter}Ben{Enter}Chloe{Enter}Diego');
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveTextContent('Preview: 4 teammates');
    await userEvent.click(screen.getByRole('button', { name: 'Add 4 teammates →' }));

    expect(await screen.findByRole('heading', { name: 'Who needs a little extra help?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ava' }));
    await userEvent.click(screen.getByRole('button', { name: /who could sit anywhere/ }));

    expect(screen.getByRole('button', { name: 'Ava' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Chloe' }));
    await userEvent.click(screen.getByRole('button', { name: /check your team/ }));

    expect(await screen.findByRole('heading', { name: 'Meet your team' })).toBeInTheDocument();
    expect(levelsOf(latest())).toEqual({ Ava: 1, Ben: 2, Chloe: 3, Diego: 2 });
    expect(within(screen.getByRole('region', { name: 'Mostly independent' })).getByText('2 teammates')).toBeInTheDocument();
  });

  it('makes everyone not picked a 2 when leaving the anywhere part by the progress bar', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava', 1), student('b', 'Ben', null)]), '/students?part=anywhere');
    await userEvent.click(screen.getByRole('button', { name: /Anything else/ }));
    expect(levelsOf(latest())).toEqual({ Ava: 1, Ben: 2 });
  });

  it('moves a teammate by tapping their name, then a basket', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava', 2), student('b', 'Ben', 2)]));
    await userEvent.click(screen.getByRole('button', { name: 'Ben' }));
    expect(screen.getByText('Now click the basket for Ben.')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('region', { name: 'Needs close support' })).getByRole('button', { name: 'Put here' }));
    expect(levelsOf(latest())).toEqual({ Ava: 2, Ben: 1 });
  });

  it('moves a teammate by typing the start of their name and pressing Enter', async () => {
    const { latest } = renderStep(docWith([student('a', 'Finn', 2), student('b', 'Fiona', 2), student('c', 'Ava', 2)]));
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'fio');
    expect(screen.getByRole('option', { name: 'Fiona' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Level 3, Could sit anywhere' }));

    expect(levelsOf(latest())).toEqual({ Finn: 2, Fiona: 3, Ava: 2 });
    expect(screen.getByText('Fiona is now in “Could sit anywhere”.')).toBeInTheDocument();
  });

  it('moves a teammate whose whole name is typed, without picking from the list', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava', 2)]));
    await userEvent.type(screen.getByRole('combobox'), 'ava{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Level 1, Needs close support' }));
    expect(levelsOf(latest())).toEqual({ Ava: 1 });
  });

  it('makes everyone without a level a 2 from the baskets', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava'), student('b', 'Ben', 1)]));
    await userEvent.click(screen.getByRole('button', { name: 'Make them a 2' }));
    expect(levelsOf(latest())).toEqual({ Ava: 2, Ben: 1 });
  });

  it('offers a way back to the step that sent the manager here', async () => {
    renderStep(docWith([student('a', 'Ava', 2)]), '/students?part=check', { state: { returnTo: '/seats' } });
    await userEvent.click(screen.getByRole('button', { name: 'Back to Seats' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/seats');
  });

  it('hides levels while private info is hidden', () => {
    renderStep(docWith([student('a', 'Ava', 1)]), '/students?part=check', { hidden: true });
    expect(screen.getByText(/Private info is hidden/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Needs close support' })).not.toBeInTheDocument();
  });

  it('keeps names being typed when private info is hidden and shown again', async () => {
    function Toggle() {
      const [hidden, setHidden] = useState(false);
      return (
        <PrivacyContext.Provider value={{ hidden, toggle: () => setHidden((on) => !on) }}>
          <button onClick={() => setHidden((on) => !on)}>Toggle privacy</button>
          <TestClassroom initial={emptyDoc()}>
            <MemoryRouter initialEntries={['/students']}>
              <Routes>
                <Route path="/students" element={<StudentsStep />} />
              </Routes>
            </MemoryRouter>
          </TestClassroom>
        </PrivacyContext.Provider>
      );
    }
    render(<Toggle />);
    await userEvent.type(screen.getByLabelText('Names, one on each line'), 'Ava, 1');
    await userEvent.click(screen.getByRole('button', { name: 'Toggle privacy' }));
    expect(screen.getByText(/Private info is hidden/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Names, one on each line')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Toggle privacy' }));
    expect(screen.getByLabelText('Names, one on each line')).toHaveValue('Ava, 1');
  });

  it('opens a teammate to set needs and a private note', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava', 2)]), '/students?part=extras');
    await userEvent.click(screen.getByRole('button', { name: /Ava/ }));
    const dialog = screen.getByRole('dialog', { name: 'Ava' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Needs to sit near the front' }));
    await userEvent.type(within(dialog).getByLabelText('Private note'), 'Glasses');

    expect(latest()?.students[0].needs).toEqual({ 'near-front': 'must' });
    expect(latest()?.students[0].note).toBe('Glasses');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('doesn’t add the same team twice when the list is pasted again with first names only', async () => {
    const { latest } = renderStep(docWith([student('a', 'Noah'), student('b', 'Ava')]), '/students?part=names');
    await userEvent.type(screen.getByLabelText('Names, one on each line'), 'Noah Smith{enter}Ava Rossi{enter}Liam Cruz');
    expect(await screen.findByRole('button', { name: 'Add 1 teammate →' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 teammate →' }));
    expect(latest()?.students.map((s) => s.name)).toEqual(['Noah', 'Ava', 'Liam']);
  });

  it('lists the team beside the names, and takes one out after asking', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava'), student('b', 'Ben')]), '/students?part=names');
    expect(screen.getByRole('heading', { name: 'Your team · 2' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Ava' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(latest()!.students.map((s) => s.name)).toEqual(['Ben']);
  });

  it('removes every name only after asking', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ava'), student('b', 'Ben')]), '/students?part=names');
    await userEvent.click(screen.getByRole('button', { name: 'Remove all names' }));
    expect(screen.getByRole('group', { name: 'Remove every name?' })).toHaveTextContent('Are you sure?');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(latest()?.students.length ?? 2).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: 'Remove all names' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove all' }));
    expect(latest()!.students).toEqual([]);
  });

  it('stays on the names and explains when some names weren’t added', async () => {
    renderStep(docWith([student('a', 'Ava')]), '/students?part=names');
    await userEvent.type(screen.getByLabelText('Names, one on each line'), 'Ava{enter}Ben');
    await userEvent.click(await screen.findByRole('button', { name: 'Add 1 teammate →' }));
    expect(screen.getByText(/Ava is already in your team/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add your teammates' })).toBeInTheDocument();
  });

  it('shows no names at all while private info is hidden', () => {
    renderStep(docWith([student('a', 'Ava', 1)]), '/students?part=extras', { hidden: true });
    expect(screen.queryByText('Ava')).not.toBeInTheDocument();
  });

  it('picks a teammate by typing the first letters and pressing Enter', async () => {
    const { latest } = renderStep(docWith([student('a', 'Hugo Silva'), student('b', 'Ava Rossi')]), '/students?part=support');
    const box = screen.getByRole('combobox', { name: 'Type a name' });
    await userEvent.type(box, 'hu');
    expect(screen.getByText('Enter to pick Hugo Silva.')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(levelsOf(latest())).toEqual({ 'Hugo Silva': 1, 'Ava Rossi': null });
    expect(within(screen.getByRole('region', { name: 'Needs close support' })).getByText('Hugo Silva')).toBeInTheDocument();
  });

  it('puts back the level a teammate had when they are taken out of the box', async () => {
    const { latest } = renderStep(docWith([student('a', 'Noah', 3)]), '/students?part=support');
    await userEvent.click(screen.getByRole('button', { name: 'Noah' }));
    expect(levelsOf(latest())).toEqual({ Noah: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Noah' }));
    expect(levelsOf(latest())).toEqual({ Noah: 3 });
  });

  it('picks a teammate dragged into the basket with the mouse', () => {
    const { latest } = renderStep(docWith([student('a', 'Hugo Silva'), student('b', 'Ava Rossi')]), '/students?part=support');
    const basket = screen.getByRole('region', { name: 'Needs close support' });
    // jsdom has no layout: the pointer is "over" the basket by fiat.
    const elementFromPoint = vi.fn(() => basket);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: elementFromPoint });
    const hugo = screen.getByRole('button', { name: 'Hugo Silva' });
    fireEvent.pointerDown(hugo, { button: 0, clientX: 10, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerMove(hugo, { clientX: 60, clientY: 60, pointerType: 'mouse' });
    fireEvent.pointerMove(hugo, { clientX: 80, clientY: 80, pointerType: 'mouse' });
    fireEvent.pointerUp(hugo, { clientX: 80, clientY: 80, pointerType: 'mouse' });
    fireEvent.click(hugo);
    expect(levelsOf(latest())).toEqual({ 'Hugo Silva': 1, 'Ava Rossi': null });
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('moves a teammate dragged to another basket when checking the team', () => {
    const { latest } = renderStep(docWith([student('a', 'Ava', 2), student('b', 'Ben', 1)]), '/students?part=check');
    const anywhere = screen.getByRole('region', { name: 'Could sit anywhere' });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => anywhere) });
    const ava = screen.getByRole('button', { name: 'Ava' });
    fireEvent.pointerDown(ava, { button: 0, clientX: 10, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerMove(ava, { clientX: 60, clientY: 60, pointerType: 'mouse' });
    fireEvent.pointerMove(ava, { clientX: 90, clientY: 90, pointerType: 'mouse' });
    fireEvent.pointerUp(ava, { clientX: 90, clientY: 90, pointerType: 'mouse' });
    expect(levelsOf(latest())).toEqual({ Ava: 3, Ben: 1 });
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('shows the whole step on one page, and remembers that choice', async () => {
    const { latest } = renderStep(docWith([student('a', 'Ben'), student('b', 'Ava')]));
    await userEvent.click(screen.getByRole('button', { name: 'All on one page' }));
    expect(screen.getByRole('heading', { name: 'Your team on one page' })).toBeInTheDocument();
    expect(localStorage.getItem('seating.studentsView')).toBe('onePage');

    const rows = screen.getAllByRole('radiogroup');
    expect(rows.map((row) => row.getAttribute('aria-labelledby') && document.getElementById(row.getAttribute('aria-labelledby')!)?.textContent)).toEqual(['Ava', 'Ben']);
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Ben' })).getByRole('radio', { name: '3, Could sit anywhere' }));
    expect(levelsOf(latest())).toEqual({ Ben: 3, Ava: null });
    await userEvent.click(screen.getByRole('button', { name: 'Make them a 2' }));
    expect(levelsOf(latest())).toEqual({ Ben: 3, Ava: 2 });
    expect(screen.getByRole('heading', { name: 'Needs and notes' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Step by step' }));
    localStorage.clear();
  });
});
