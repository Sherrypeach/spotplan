import { createContext, useContext } from 'react';

import type { ClassroomDocument } from '@modules/classroom/document';

export type ClassSummary = { id: number; name: string; studentCount: number };

/**
 * - unsaved: changed, waiting a moment before saving
 * - error: the last save didn't reach the server; it retries on the next change
 * - conflict: the class changed elsewhere (another tab or device); saving stops
 * - rejected: the server refused the class as it is; saving stops
 */
export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict' | 'rejected';

export type ClassroomContextValue = {
  /** none: the teacher has no class yet. */
  status: 'loading' | 'none' | 'ready' | 'error';
  /** The error is this tab running an older app than the one that saved the class: only a reload helps. */
  outdated?: boolean;
  classes: ClassSummary[];
  current: { id: number; name: string } | null;
  doc: ClassroomDocument | null;
  /** Changes the open class; false when no class is open or saving has stopped, so nothing changed. */
  update: (edit: (doc: ClassroomDocument) => ClassroomDocument) => boolean;
  saveState: SaveState;
  retrySave: () => void;
  /** Saves now and waits; true when nothing is left unsaved (e.g. before signing out). */
  saveNow: () => Promise<boolean>;
  selectClass: (id: number) => Promise<void>;
  /** False when the teacher chose to keep unsaved changes instead. */
  createClass: (name: string) => Promise<boolean>;
  /** Loads the class again from the server, dropping unsaved changes. */
  reload: () => void;
  /** Goes up each time a class is loaded, so screens can forget history that came before. */
  loads: number;
};

export const ClassroomContext = createContext<ClassroomContextValue | null>(null);

export function useClassroom(): ClassroomContextValue {
  const context = useContext(ClassroomContext);
  if (!context) throw new Error('useClassroom must be used inside ClassroomProvider');
  return context;
}

/** The loaded class document; only for screens shown once a class is ready. */
export function useClassDoc(): ClassroomDocument {
  const { doc } = useClassroom();
  if (!doc) throw new Error('useClassDoc needs a loaded team');
  return doc;
}
