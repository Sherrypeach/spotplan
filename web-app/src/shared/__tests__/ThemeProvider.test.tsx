// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { THEME_KEY } from '@shared/theme';
import { ThemeProvider } from '@shared/ThemeProvider';
import { useTheme } from '@shared/themeContext';

// The smallest switch, standing in for the account menu's Dark mode item.
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      Dark mode{dark ? ': on' : ''}
    </button>
  );
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('switches to dark and remembers it on this device', async () => {
    renderToggle();
    await userEvent.click(screen.getByRole('button', { name: /Dark mode/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark mode: on' })).toBeInTheDocument();
  });

  it('ignores a saved value it doesn’t know', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    renderToggle();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows a choice made in another tab', () => {
    renderToggle();
    localStorage.setItem(THEME_KEY, 'dark');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }));
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
