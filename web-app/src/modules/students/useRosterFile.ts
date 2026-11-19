import { useEffect, useRef, useState } from 'react';

import type { ColorTag } from '@modules/classroom/document';
import { readRosterFile, RosterFileError } from '@modules/classroom/roster/file';
import type { RosterEntry } from '@modules/classroom/rosterImport';

// A class holds 60; a few times that is plenty to pick from and keeps the notebook quick.
const MAX_FILE_ENTRIES = 240;

type Options = {
  tags: ColorTag[];
  /** `note` explains anything left out (a long file, a second file). */
  onRead: (entries: RosterEntry[], note: string | null) => void;
  onError: (message: string) => void;
};

/**
 * Reads a picked or dropped roster file. Only the latest file counts if two
 * are read at once, and a file dropped anywhere on the page doesn't make the
 * browser leave the app.
 */
export function useRosterFile({ tags, onRead, onError }: Options) {
  const [dragging, setDragging] = useState(false);
  const latest = useRef(0);

  const read = async (files: FileList | null | undefined) => {
    const file = files?.[0];
    if (!file) return;
    const notes: string[] = files.length > 1 ? ['We read only the first file. Drop one file at a time.'] : [];
    latest.current += 1;
    const id = latest.current;
    try {
      const entries = await readRosterFile(file, tags);
      if (id !== latest.current) return;
      if (entries.length === 0) {
        onError('We didn’t find any names in that file. Check that it has a column of names.');
        return;
      }
      if (entries.length > MAX_FILE_ENTRIES) notes.push(`That file is long, so we took the first ${MAX_FILE_ENTRIES} names.`);
      onRead(entries.slice(0, MAX_FILE_ENTRIES), notes.length > 0 ? notes.join(' ') : null);
    } catch (failure) {
      if (id !== latest.current) return;
      onError(failure instanceof RosterFileError ? failure.message : 'We couldn’t read that file. Try saving it as CSV.');
    }
  };

  // A file dropped outside the notebook would otherwise open in the browser and leave the app.
  useEffect(() => {
    const block = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const dropZone = {
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: React.DragEvent) => {
      setDragging(false);
      if (event.dataTransfer.files.length === 0) return;
      event.preventDefault();
      void read(event.dataTransfer.files);
    },
  };

  return { read, dropZone, dragging };
}
