// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { FooterBar } from '@modules/shell/FooterBar';
import { TourContext } from '@modules/tour/tour';

function renderFooter(available: boolean) {
  const start = vi.fn();
  render(
    <TourContext.Provider value={{ start, available }}>
      <MemoryRouter>
        <FooterBar />
      </MemoryRouter>
    </TourContext.Provider>,
  );
  return start;
}

describe('the footer bar', () => {
  it('names the maker, links to help and the tour, with this year', async () => {
    const start = renderFooter(true);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('SpotPlan');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`© ${new Date().getFullYear()}`);
    expect(screen.getByRole('link', { name: 'How to use' })).toHaveAttribute('href', '/how-to-use');
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(start).toHaveBeenCalled();
  });

  it('leaves the tour out while it can’t run', () => {
    renderFooter(false);
    expect(screen.queryByRole('button', { name: 'Take the tour' })).not.toBeInTheDocument();
  });
});
