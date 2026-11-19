import { useCallback, useEffect, useRef, useState } from 'react';

import { useClassroom } from '@modules/classroom/classroom';
import { isStopped } from '@modules/classroom/useAutosave';

// Up to 80 steps back.
const MAX_STEPS = 80;

/**
 * Remembers every version of the room while the Room step is open, so any
 * change (a drag, a size, a new setup) can be taken back one at a time. Ctrl+Z
 * (Cmd+Z on a Mac) does the same, except while typing in a field. Loading
 * the class again starts a fresh history, and Undo waits while saving is stopped
 * or while `busy` work is about to change the class.
 */
export function useRoomHistory<T>(room: T, apply: (room: T) => void, busy = false) {
  const { loads, saveState } = useClassroom();
  const paused = isStopped(saveState) || busy;
  const past = useRef<T[]>([]);
  const previous = useRef(room);
  const undoing = useRef(false);
  const loadedAt = useRef(loads);
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    if (loads !== loadedAt.current) {
      loadedAt.current = loads;
      past.current = [];
      previous.current = room;
      undoing.current = false;
      setSteps(0);
      return;
    }
    if (room === previous.current) return;
    // A change that changes nothing (a drag back to the same spot) isn't a step.
    const same = JSON.stringify(room) === JSON.stringify(previous.current);
    if (!undoing.current && !same) {
      past.current = [...past.current, previous.current].slice(-MAX_STEPS);
      setSteps(past.current.length);
    }
    undoing.current = false;
    previous.current = room;
  }, [room, loads]);

  const undo = useCallback(() => {
    const last = past.current[past.current.length - 1];
    if (!last || paused) return;
    past.current = past.current.slice(0, -1);
    setSteps(past.current.length);
    undoing.current = true;
    apply(last);
  }, [apply, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey) || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest('input:not([type=range]), textarea, select')) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  return { undo, canUndo: steps > 0 && !paused };
}
