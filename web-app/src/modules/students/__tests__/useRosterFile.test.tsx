// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as fileModule from '@modules/classroom/roster/file';
import type { RosterEntry } from '@modules/classroom/rosterImport';
import { useRosterFile } from '@modules/students/useRosterFile';

const entry = (name: string): RosterEntry => ({ name, level: null, color: null });
const files = (...names: string[]) => names.map((name) => new File(['x'], name)) as unknown as FileList;

function setup() {
  const onRead = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() => useRosterFile({ tags: [], onRead, onError }));
  return { hook, onRead, onError };
}

describe('useRosterFile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps only the file read last when two are read at once', async () => {
    let finishFirst: (entries: RosterEntry[]) => void = () => {};
    vi.spyOn(fileModule, 'readRosterFile')
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce([entry('Ben')]);
    const { hook, onRead } = setup();
    await act(async () => {
      void hook.result.current.read(files('a.csv'));
      await hook.result.current.read(files('b.csv'));
      finishFirst([entry('Ava')]);
    });
    expect(onRead).toHaveBeenCalledOnce();
    expect(onRead).toHaveBeenCalledWith([entry('Ben')], null);
  });

  it('cuts a very long file and says so', async () => {
    vi.spyOn(fileModule, 'readRosterFile').mockResolvedValue(Array.from({ length: 300 }, (_, i) => entry(`Person ${i}`)));
    const { hook, onRead } = setup();
    await act(() => hook.result.current.read(files('a.csv')));
    const [rows, note] = onRead.mock.calls[0];
    expect(rows).toHaveLength(240);
    expect(note).toMatch(/first 240 names/);
  });

  it('reads the first of several dropped files and says so', async () => {
    vi.spyOn(fileModule, 'readRosterFile').mockResolvedValue([entry('Ava')]);
    const { hook, onRead } = setup();
    await act(() => hook.result.current.read(files('a.csv', 'b.csv')));
    expect(onRead.mock.calls[0][1]).toMatch(/only the first file/);
  });

  it('says so when a file has no names, or can’t be read', async () => {
    vi.spyOn(fileModule, 'readRosterFile')
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new fileModule.RosterFileError('We can’t read that kind of file.'));
    const { hook, onError } = setup();
    await act(() => hook.result.current.read(files('a.csv')));
    await act(() => hook.result.current.read(files('b.pdf')));
    expect(onError.mock.calls.map(([message]) => message)).toEqual([
      expect.stringMatching(/didn’t find any names/),
      'We can’t read that kind of file.',
    ]);
  });
});
