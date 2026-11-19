import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ClassroomContext, type ClassroomContextValue, type SaveState } from '@modules/classroom/classroom';
import type { ClassroomDocument } from '@modules/classroom/document';
import { keepSeatingInRoom } from '@modules/classroom/roomSeating';

type Props = {
  initial: ClassroomDocument;
  children: ReactNode;
  /** Sees every saved version of the document, for assertions. */
  onChange?: (doc: ClassroomDocument) => void;
  /** How saving is going, to test the screens' failure states. */
  saveState?: SaveState;
  /** What "save now" reports (false: something couldn't be saved). */
  saveNow?: () => Promise<boolean>;
};

/** A ClassroomContext backed by plain state, so step screens can be tested without the API. */
export function TestClassroom({ initial, children, onChange, saveState = 'saved', saveNow }: Props) {
  const [doc, setDoc] = useState(initial);
  // Reported from an effect, once per change, even under StrictMode's double updates.
  const reported = useRef(doc);
  useEffect(() => {
    if (doc === reported.current) return;
    reported.current = doc;
    onChange?.(doc);
  }, [doc, onChange]);
  const value = useMemo<ClassroomContextValue>(
    () => ({
      status: 'ready',
      classes: [{ id: 1, name: 'Room 12', studentCount: doc.students.length }],
      current: { id: 1, name: 'Room 12' },
      doc,
      update: (edit) => {
        setDoc((current) => keepSeatingInRoom(current, edit(current)));
        return true;
      },
      saveState,
      retrySave: () => {},
      saveNow: saveNow ?? (async () => true),
      selectClass: async () => {},
      createClass: async () => true,
      reload: () => {},
      loads: 1,
    }),
    [doc, saveState, saveNow],
  );
  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
}
