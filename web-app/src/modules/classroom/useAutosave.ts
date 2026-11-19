import { ApolloError } from '@apollo/client';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SaveState } from '@modules/classroom/classroom';
import { apiErrorCode } from '@shared/apiErrors';
import { rememberUnsavedChanges } from '@shared/unsavedOnSignOut';

// Typing a name or tapping a few students in a row makes one save, not ten.
// The API caps saves per minute with this delay in mind (ClassroomWriteLimiterService).
const SAVE_DELAY_MS = 800;
// The server refused this exact document: sending it again won't help.
// PAYLOAD_TOO_LARGE comes as a GraphQL code when the API's own size check refuses the class.
const REFUSED_CODES = ['BAD_REQUEST', 'BAD_USER_INPUT', 'NOT_FOUND', 'FORBIDDEN', 'PAYLOAD_TOO_LARGE'];
const PAYLOAD_TOO_LARGE = 413;

type Options<T> = {
  /** Saves `value`; resolves with the new revision. */
  save: (value: T, revision: number) => Promise<number>;
};

function failedState(error: unknown): SaveState {
  const code = apiErrorCode(error);
  if (code === 'CONFLICT') return 'conflict';
  if (code && REFUSED_CODES.includes(code)) return 'rejected';
  const network = error instanceof ApolloError ? error.networkError : null;
  if (network && 'statusCode' in network && network.statusCode === PAYLOAD_TOO_LARGE) return 'rejected';
  return 'error';
}

/** States where saving has stopped until the class is loaded again. */
export function isStopped(state: SaveState): boolean {
  return state === 'conflict' || state === 'rejected';
}

/**
 * Saves the latest value shortly after each change, one save at a time,
 * always on top of the last revision the server confirmed.
 */
export function useAutosave<T>({ save }: Options<T>) {
  const [state, setStateValue] = useState<SaveState>('saved');

  const latest = useRef<T | null>(null);
  const revision = useRef(0);
  const savedValue = useRef<T | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const stateRef = useRef<SaveState>('saved');
  // Goes up each time another class is loaded: answers to saves of the old one are ignored.
  const generation = useRef(0);
  // A save whose answer never came back: the server may have it. It's sent again,
  // unchanged, before anything newer, so the server can tell it's the same save
  // instead of taking the newer one for someone else's change.
  const unanswered = useRef<T | null>(null);

  const setState = useCallback((next: SaveState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const runSave = useCallback(async (): Promise<void> => {
    if (isStopped(stateRef.current) || latest.current === null || latest.current === savedValue.current) return;
    if (inFlight.current) {
      await inFlight.current;
      return runSave();
    }
    const resend = unanswered.current;
    const snapshot = resend ?? latest.current;
    const started = generation.current;
    setState('saving');
    let failed = false;
    const attempt = (async () => {
      try {
        const next = await save(snapshot, revision.current);
        if (started !== generation.current) return;
        unanswered.current = null;
        revision.current = next;
        savedValue.current = snapshot;
        setState(latest.current === snapshot ? 'saved' : 'unsaved');
      } catch (error) {
        failed = true;
        if (started !== generation.current) return;
        const next = failedState(error);
        if (next === 'error') unanswered.current = snapshot;
        setState(next);
      }
    })();
    inFlight.current = attempt;
    await attempt;
    if (inFlight.current === attempt) inFlight.current = null;
    // Changes made while saving go right after. A failed save waits for the
    // next change or "Try again", so a dropped connection doesn't spin.
    if (!failed && started === generation.current && latest.current !== savedValue.current) await runSave();
  }, [save, setState]);

  /** Starts tracking a freshly loaded value; nothing to save yet. */
  const reset = useCallback(
    (value: T, serverRevision: number) => {
      window.clearTimeout(timer.current);
      generation.current += 1;
      inFlight.current = null;
      unanswered.current = null;
      latest.current = value;
      savedValue.current = value;
      revision.current = serverRevision;
      setState('saved');
    },
    [setState],
  );

  const changed = useCallback(
    (value: T) => {
      latest.current = value;
      if (isStopped(stateRef.current)) return;
      setState('unsaved');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void runSave(), SAVE_DELAY_MS);
    },
    [runSave, setState],
  );

  /** Saves now (e.g. before switching class) and waits; true when nothing is left unsaved. */
  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    await runSave();
    return !isStopped(stateRef.current) && stateRef.current !== 'error' && latest.current === savedValue.current;
  }, [runSave]);

  const retry = useCallback(() => void flush(), [flush]);

  // Back online after a failed save: try again. Leaving the tab (switching apps
  // on an iPad, closing it): save now instead of waiting.
  useEffect(() => {
    const online = () => {
      if (stateRef.current === 'error') void flush();
    };
    const hidden = (event: Event) => {
      const leaving = event.type === 'pagehide' || document.visibilityState === 'hidden';
      if (leaving && latest.current !== savedValue.current) void flush();
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', hidden);
    return () => {
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', hidden);
    };
  }, [flush]);

  // Leaving with changes the server doesn't have yet asks first, also when saving has stopped.
  useEffect(() => {
    if (state === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current !== savedValue.current || stateRef.current === 'saving') event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      // Closing with changes not saved (the session ran out mid-edit): the sign-in page says so.
      if (latest.current !== savedValue.current) rememberUnsavedChanges();
    },
    [],
  );

  return { state, reset, changed, flush, retry };
}
