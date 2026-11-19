// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { applyTheme } from '@shared/theme';

describe('applyTheme', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  it('paints the chosen theme inside the app', () => {
    window.history.pushState({}, '', '/room');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('keeps the sign-in pages light', () => {
    window.history.pushState({}, '', '/auth/login');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('keeps the bare /auth path light too, but not a page that only starts with the letters', () => {
    window.history.pushState({}, '', '/auth');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('light');
    window.history.pushState({}, '', '/authors');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
