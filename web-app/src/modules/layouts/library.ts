import type { LayoutLibrary } from './types';

// The library is large, so it loads in its own chunk the first time it's needed.
export async function loadLayoutLibrary(): Promise<LayoutLibrary> {
  const data = await import('./library.json');
  return data.default as LayoutLibrary;
}
