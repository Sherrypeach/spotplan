// Only a yes/no flag is kept: never any of the class itself.
const KEY = 'seating.unsavedOnSignOut';

/** Notes that the class closed with changes the server never got (e.g. the session ran out). */
export function rememberUnsavedChanges(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: the sign-in page just shows its usual notice.
  }
}

/** Whether the last class closed with unsaved changes; reading it clears it. */
export function takeUnsavedChanges(): boolean {
  try {
    const unsaved = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return unsaved;
  } catch {
    return false;
  }
}
