export type Theme = 'light' | 'dark';

import { isAuthPath } from '@shared/authPath';

// The teacher's choice on this device (index.html reads this key too). Until they pick, the device setting decides.
export const THEME_KEY = 'seating.theme';

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked; the choice lasts until the page closes.
  }
}

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function deviceTheme(): Theme {
  return window.matchMedia?.(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}


/** Paints the page in `theme` (index.css switches every color on data-theme); the sign-in pages are always light. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = isAuthPath(window.location.pathname) ? 'light' : theme;
}
