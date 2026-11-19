import { createContext, useContext } from 'react';

import type { Theme } from '@shared/theme';

export type ThemeValue = { theme: Theme; setTheme: (theme: Theme) => void };

export const ThemeContext = createContext<ThemeValue>({ theme: 'light', setTheme: () => {} });

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
