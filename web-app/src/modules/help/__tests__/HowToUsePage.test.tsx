// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HowToUsePage } from '@modules/help/HowToUsePage';
import { TourContext } from '@modules/tour/tour';

describe('How to use', () => {
  it('links each step, answers common questions, and starts the tour again', async () => {
    const start = vi.fn();
    render(
      <TourContext.Provider value={{ start, available: true }}>
        <MemoryRouter>
          <HowToUsePage />
        </MemoryRouter>
      </TourContext.Provider>,
    );
    expect(screen.getByRole('link', { name: /Go to Room/ })).toHaveAttribute('href', '/room');
    expect(screen.getAllByRole('link', { name: /^Go to/ })).toHaveLength(4);
    await userEvent.click(screen.getByText('How do I undo a change?'));
    expect(screen.getByText(/Ctrl\+Z/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour again' }));
    expect(start).toHaveBeenCalled();
  });
});
