import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ClassroomById, CreateClassroom, MyClassrooms, SaveClassroom } from '@graphql/operations/classroom';
import { ClassroomContext, type ClassroomContextValue } from '@modules/classroom/classroom';
import { asClassroomDocument, type ClassroomDocument, OutdatedAppError } from '@modules/classroom/document';
import { isStopped, useAutosave } from '@modules/classroom/useAutosave';
import { keepSeatingInRoom } from '@modules/classroom/roomSeating';
import { readStored, writeStored } from '@shared/storage';

// Which class the teacher had open last, on this device. A convenience only.
const LAST_CLASS_KEY = 'seating.lastClass';

function rememberedClass(): number | null {
  const value = Number(readStored(LAST_CLASS_KEY));
  return Number.isInteger(value) && value > 0 ? value : null;
}

const DISCARD_QUESTION = 'Some of your changes to this team haven’t been saved. Open the other team anyway and lose them?';

type Props = {
  children: ReactNode;
};

/** Loads the teacher's classes and the open class, and saves its changes as the teacher works. */
export function ClassroomProvider({ children }: Props) {
  const client = useApolloClient();
  const classesQuery = useQuery(MyClassrooms, { fetchPolicy: 'cache-and-network' });
  const [saveMutation] = useMutation(SaveClassroom);
  const [createMutation] = useMutation(CreateClassroom, { refetchQueries: [MyClassrooms] });

  const [current, setCurrent] = useState<{ id: number; name: string } | null>(null);
  const [doc, setDoc] = useState<ClassroomDocument | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [outdated, setOutdated] = useState(false);
  const docRef = useRef<ClassroomDocument | null>(null);
  const currentId = useRef<number | null>(null);
  // The class being opened, and a counter so only the latest open counts.
  const openingId = useRef<number | null>(null);
  const openCount = useRef(0);

  const [loads, setLoads] = useState(0);
  const save = useCallback(
    async (value: ClassroomDocument, revision: number) => {
      const id = currentId.current;
      if (id === null) return revision;
      const { data } = await saveMutation({ variables: { id, input: { document: value, revision } } });
      return data?.saveClassroom.revision ?? revision;
    },
    [saveMutation],
  );
  const autosave = useAutosave<ClassroomDocument>({ save });
  const { reset, changed, flush } = autosave;
  const saveStateRef = useRef(autosave.state);
  useEffect(() => {
    saveStateRef.current = autosave.state;
  }, [autosave.state]);

  const open = useCallback(
    async (id: number) => {
      openCount.current += 1;
      const thisOpen = openCount.current;
      openingId.current = id;
      setLoadFailed(false);
      // Nothing from the previous class shows (or can be edited) while the next one loads.
      if (currentId.current !== id) {
        docRef.current = null;
        setDoc(null);
      }
      try {
        const { data } = await client.query({ query: ClassroomById, variables: { id }, fetchPolicy: 'network-only' });
        if (thisOpen !== openCount.current) return;
        const loaded = asClassroomDocument(data.classroom.document);
        currentId.current = id;
        docRef.current = loaded;
        reset(loaded, data.classroom.revision);
        setCurrent({ id, name: data.classroom.name });
        setDoc(loaded);
        setLoads((count) => count + 1);
        writeStored(LAST_CLASS_KEY, String(id));
      } catch (failure) {
        if (thisOpen !== openCount.current) return;
        setLoadFailed(true);
        setOutdated(failure instanceof OutdatedAppError);
      }
    },
    [client, reset],
  );

  const update = useCallback(
    (edit: (value: ClassroomDocument) => ClassroomDocument) => {
      // Once saving has stopped, edits would be lost: the class must be loaded again first.
      if (!docRef.current || isStopped(saveStateRef.current)) return false;
      const next = keepSeatingInRoom(docRef.current, edit(docRef.current));
      if (next === docRef.current) return true;
      docRef.current = next;
      setDoc(next);
      changed(next);
      return true;
    },
    [changed],
  );

  // Saves what's pending first; if that fails, asks before throwing it away.
  const leaveCurrent = useCallback(async () => {
    if (docRef.current === null) return true;
    return (await flush()) || window.confirm(DISCARD_QUESTION);
  }, [flush]);

  const selectClass = useCallback(
    async (id: number) => {
      if (id === openingId.current || !(await leaveCurrent())) return;
      await open(id);
    },
    [leaveCurrent, open],
  );

  const createClass = useCallback(
    async (name: string) => {
      if (!(await leaveCurrent())) return false;
      const { data } = await createMutation({ variables: { input: { name } } });
      if (data) await open(data.createClassroom.id);
      return true;
    },
    [createMutation, leaveCurrent, open],
  );

  const { refetch } = classesQuery;
  const reload = useCallback(() => {
    // The class list failing (e.g. after adding a class) also shows the error page.
    if (classesQuery.error) void refetch();
    const id = openingId.current ?? currentId.current;
    if (id !== null) void open(id);
    else void refetch();
  }, [classesQuery.error, open, refetch]);

  const classes = useMemo(() => classesQuery.data?.myClassrooms ?? [], [classesQuery.data]);

  const status: ClassroomContextValue['status'] = (() => {
    if (classesQuery.error || loadFailed) return 'error';
    if (!classesQuery.data) return 'loading';
    if (classes.length === 0) return 'none';
    return doc ? 'ready' : 'loading';
  })();

  const value = useMemo<ClassroomContextValue>(
    () => ({
      status,
      classes,
      current,
      doc,
      update,
      saveState: autosave.state,
      retrySave: autosave.retry,
      saveNow: flush,
      selectClass,
      createClass,
      reload,
      loads,
      outdated,
    }),
    [outdated, status, classes, current, doc, update, autosave.state, autosave.retry, flush, selectClass, createClass, reload, loads],
  );

  // Opens the class used last on this device, or the first one.
  useEffect(() => {
    if (openingId.current !== null || classes.length === 0) return;
    const last = rememberedClass();
    const first = classes.find((c) => c.id === last) ?? classes[0];
    void open(first.id);
  }, [classes, open]);

  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
}
