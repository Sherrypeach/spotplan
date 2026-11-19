// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { TourProvider } from '@modules/tour/TourProvider';
import { useTour } from '@modules/tour/tour';
import { emptyDoc } from '@test/classroomDocs';
import { LocationProbe } from '@test/LocationProbe';
import { TestClassroom } from '@test/TestClassroom';

function StartAgain() {
  const { start } = useTour();
  return (
    <button type="button" onClick={start}>
      Take the tour again
    </button>
  );
}

// A page with the first stop's part on it, measured where a browser would draw it.
function StepsPart() {
  return (
    <div
      data-tour="steps"
      ref={(element) => {
        if (element) element.getBoundingClientRect = () => ({ top: 100, left: 20, width: 200, height: 300, right: 220, bottom: 400, x: 20, y: 100, toJSON: () => ({}) });
      }}
    />
  );
}

function renderTour() {
  return render(
    <TestClassroom initial={emptyDoc()}>
      <MemoryRouter initialEntries={['/room']}>
        <TourProvider>
          <StartAgain />
          <StepsPart />
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </TourProvider>
      </MemoryRouter>
    </TestClassroom>,
  );
}

describe('the tour', () => {
  beforeEach(() => localStorage.clear());

  it('welcomes a first-time manager and walks through each step on its own page', async () => {
    renderTour();
    expect(screen.getByRole('dialog', { name: 'Welcome' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/students');
    for (let i = 0; i < 2; i++) await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Draw your room' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/room');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Add your team' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument();
  });

  it('doesn’t welcome again once turned down, but can be started again', async () => {
    const first = renderTour();
    await userEvent.click(screen.getByRole('button', { name: 'I’ll explore' }));
    first.unmount();
    renderTour();
    expect(screen.queryByRole('dialog', { name: 'Welcome' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour again' }));
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('lights up the part it talks about and puts the bubble beside it, with Next ready', async () => {
    renderTour();
    await userEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    // The part's bottom (400) + the halo (8) + the gap (12).
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Four steps' })).toHaveStyle({ top: '420px' }));
    expect(screen.getByRole('button', { name: /Next/ })).toHaveFocus();
  });

  it('ends with Escape or Done, and remembers it was seen', async () => {
    renderTour();
    await userEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument();
    expect(localStorage.getItem('seating.tourSeen')).toBe('1');
    localStorage.clear();
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour again' }));
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument();
    expect(localStorage.getItem('seating.tourSeen')).toBe('1');
  });
});
