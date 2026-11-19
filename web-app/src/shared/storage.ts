/**
 * localStorage that never throws: storage can be blocked (private mode, site
 * settings), and these are conveniences only, never data the app depends on.
 */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}
