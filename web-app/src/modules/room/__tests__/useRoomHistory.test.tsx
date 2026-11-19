// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ClassroomContext, type ClassroomContextValue, type SaveState } from '@modules/classroom/classroom';
import { useRoomHistory } from '@modules/room/useRoomHistory';
import { emptyDoc } from '@test/classroomDocs';

function context(loads: number, saveState: SaveState = 'saved'): ClassroomContextValue {
  return {
    status: 'ready',
    classes: [],
    current: { id: 1, name: 'Room 12' },
    doc: emptyDoc(),
    update: () => true,
    saveState,
    retrySave: () => {},
    saveNow: async () => true,
    selectClass: async () => {},
    createClass: async () => true,
    reload: () => {},
    loads,
  };
}

function setup() {
  const apply = vi.fn();
  let value = context(1);
  const wrapper = ({ children }: { children: ReactNode }) => <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
  const hook = renderHook(({ room }) => useRoomHistory(room, apply), { wrapper, initialProps: { room: { width: 1 } } });
  return {
    apply,
    hook,
    setContext: (next: ClassroomContextValue) => {
      value = next;
    },
  };
}

describe('useRoomHistory', () => {
  it('takes back one change at a time', () => {
    const { apply, hook } = setup();
    hook.rerender({ room: { width: 2 } });
    expect(hook.result.current.canUndo).toBe(true);
    act(() => hook.result.current.undo());
    expect(apply).toHaveBeenCalledWith({ width: 1 });
  });

  it('forgets the history when the team is loaded again', () => {
    const { hook, setContext } = setup();
    hook.rerender({ room: { width: 2 } });
    setContext(context(2));
    hook.rerender({ room: { width: 5 } });
    expect(hook.result.current.canUndo).toBe(false);
  });

  it('waits while saving is stopped', () => {
    const { apply, hook, setContext } = setup();
    hook.rerender({ room: { width: 2 } });
    setContext(context(1, 'conflict'));
    hook.rerender({ room: { width: 2 } });
    expect(hook.result.current.canUndo).toBe(false);
    act(() => hook.result.current.undo());
    expect(apply).not.toHaveBeenCalled();
  });
});
