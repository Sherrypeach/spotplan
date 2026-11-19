// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ClassroomContext, type ClassroomContextValue } from '@modules/classroom/classroom';
import { CreateClassScreen } from '@modules/classroom/CreateClassScreen';
import { LocationProbe } from '@test/LocationProbe';

function renderScreen(createClass: ClassroomContextValue['createClass'], update: ClassroomContextValue['update'] = () => true) {
  const onCreated = vi.fn();
  const value = { status: 'none', classes: [], current: null, createClass, update } as unknown as ClassroomContextValue;
  render(
    <ClassroomContext.Provider value={value}>
      <MemoryRouter initialEntries={['/room']}>
        <Routes>
          <Route path="/room" element={<CreateClassScreen first onCreated={onCreated} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </ClassroomContext.Provider>,
  );
  return { onCreated };
}

describe('CreateClassScreen', () => {
  it('asks for a name, then makes the team with it trimmed', async () => {
    const createClass = vi.fn(async () => true);
    const { onCreated } = renderScreen(createClass);
    await userEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(screen.getByText('Give your team a name.')).toBeInTheDocument();
    expect(createClass).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole('textbox'), '  4th grade  ');
    await userEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(createClass).toHaveBeenCalledWith('4th grade');
    expect(onCreated).toHaveBeenCalled();
  });

  it('says so when the team can’t be made', async () => {
    renderScreen(vi.fn(async () => Promise.reject(new Error('offline'))));
    await userEvent.type(screen.getByRole('textbox'), 'Room 12');
    await userEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(await screen.findByText(/couldn’t create the team/)).toBeInTheDocument();
  });

  it('makes the example team, fills it in, and opens it on Teammates', async () => {
    const createClass = vi.fn(async () => true);
    const update = vi.fn(() => true);
    renderScreen(createClass, update);
    await userEvent.click(screen.getByRole('button', { name: /try an example team/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/students');
    expect(createClass).toHaveBeenCalledWith('Example team');
    expect(update).toHaveBeenCalled();
  });
});
