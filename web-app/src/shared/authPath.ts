// The sign-in pages live under this path. index.html checks it too, before the app loads.
export const AUTH_BASE = '/auth';

export function isAuthPath(path: string): boolean {
  return path === AUTH_BASE || path.startsWith(`${AUTH_BASE}/`);
}
