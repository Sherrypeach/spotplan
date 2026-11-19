// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { TipBox } from '@components/TipBox';

// jsdom has no matchMedia; this stands in for a phone or a laptop.
function screenWidth(small: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: small, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  });
}

describe('TipBox', () => {
  afterEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('shows the tip on a big screen, and remembers when it’s hidden', async () => {
    screenWidth(false);
    const { unmount } = render(<TipBox tip="Paste your team list." />);
    expect(screen.getByText('Paste your team list.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Paste your team list.')).not.toBeInTheDocument();
    unmount();

    render(<TipBox tip="Paste your team list." />);
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });

  it('starts folded on a phone until the manager opens it', () => {
    screenWidth(true);
    render(<TipBox tip="Paste your team list." />);
    expect(screen.queryByText('Paste your team list.')).not.toBeInTheDocument();
  });

  it('stays open with no Hide when fixed, even on a phone', () => {
    screenWidth(true);
    render(<TipBox tip="Draw your room." fixed />);
    expect(screen.getByText('Draw your room.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
