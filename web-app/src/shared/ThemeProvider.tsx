import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { applyTheme, DARK_SCHEME_QUERY, deviceTheme, savedTheme, saveTheme, THEME_KEY, type Theme } from '@shared/theme';
import { ThemeContext } from '@shared/themeContext';

type Props = {
  children: ReactNode;
};

/** The page's light or dark theme, remembered on this device; until chosen, the device setting. */
export function ThemeProvider({ children }: Props) {
  const [chosen, setChosen] = useState<Theme | null>(savedTheme);
  const [device, setDevice] = useState<Theme>(deviceTheme);
  const theme = chosen ?? device;

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        saveTheme(next);
        setChosen(next);
      },
    }),
    [theme],
  );

  useEffect(() => applyTheme(theme), [theme]);

  // Until the teacher picks one, follow the device when it switches (e.g. at night).
  useEffect(() => {
    const query = window.matchMedia?.(DARK_SCHEME_QUERY);
    if (!query) return;
    const follow = () => setDevice(query.matches ? 'dark' : 'light');
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);

  // A choice made in another tab applies here too.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) setChosen(savedTheme());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
