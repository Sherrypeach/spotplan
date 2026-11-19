// @vitest-environment jsdom
import { ApolloError } from '@apollo/client';
import { act, renderHook } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutosave } from '@modules/classroom/useAutosave';

const conflict = () =>
  new ApolloError({ graphQLErrors: [new GraphQLError('Changed elsewhere', { extensions: { code: 'CONFLICT' } })] });

function setup(save: (value: string, revision: number) => Promise<number>) {
  const hook = renderHook(() => useAutosave<string>({ save }));
  act(() => hook.result.current.reset('loaded', 5));
  return hook;
}

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves once, shortly after a burst of changes, on the last revision', async () => {
    const save = vi.fn().mockResolvedValue(6);
    const { result } = setup(save);

    act(() => {
      result.current.changed('a');
      result.current.changed('ab');
      result.current.changed('abc');
    });
    expect(result.current.state).toBe('unsaved');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('abc', 5);
    expect(result.current.state).toBe('saved');
  });

  it('saves a change made during a save right after, on the new revision', async () => {
    let finishFirst: (revision: number) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<number>((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce(7);
    const { result } = setup(save);

    act(() => result.current.changed('first'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.changed('second'));
    // No waiting for the delay: the change goes as soon as the first save is answered.
    await act(async () => finishFirst(6));

    expect(save).toHaveBeenNthCalledWith(2, 'second', 6);
    expect(result.current.state).toBe('saved');
  });

  it('stops saving when the team changed somewhere else', async () => {
    const save = vi.fn().mockRejectedValue(conflict());
    const { result } = setup(save);

    act(() => result.current.changed('mine'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.state).toBe('conflict');

    act(() => result.current.changed('more'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledOnce();
  });

  it('says so when a save fails, and tries again on the next change', async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApolloError({ networkError: new TypeError('offline') })).mockResolvedValueOnce(6).mockResolvedValueOnce(7);
    const { result } = setup(save);

    act(() => result.current.changed('one'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.state).toBe('error');

    act(() => result.current.changed('two'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenLastCalledWith('two', 6);
    expect(result.current.state).toBe('saved');
  });

  it('stops saving when the server refuses the team, and says nothing was saved', async () => {
    const refused = new ApolloError({ graphQLErrors: [new GraphQLError('Too long', { extensions: { code: 'BAD_REQUEST' } })] });
    const save = vi.fn().mockRejectedValue(refused);
    const { result } = setup(save);

    act(() => result.current.changed('too long'));
    let saved = true;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(false);
    expect(result.current.state).toBe('rejected');

    act(() => result.current.changed('more'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledOnce();
  });

  it('reports a failed flush, so the caller can ask before losing changes', async () => {
    const save = vi.fn().mockRejectedValue(new ApolloError({ networkError: new TypeError('offline') }));
    const { result } = setup(save);

    act(() => result.current.changed('one'));
    let saved = true;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(false);
  });

  it('ignores the answer to a save of the team that was open before', async () => {
    let finishOld: (revision: number) => void = () => {};
    const save = vi.fn().mockImplementationOnce(() => new Promise<number>((resolve) => (finishOld = resolve))).mockResolvedValue(21);
    const { result } = setup(save);

    act(() => result.current.changed('old team'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.reset('new team', 20));
    await act(async () => finishOld(99));

    act(() => result.current.changed('new team, edited'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenLastCalledWith('new team, edited', 20);
    expect(result.current.state).toBe('saved');
  });

  it('warns before leaving the page while a change isn’t saved, even after a conflict', async () => {
    const save = vi.fn().mockRejectedValue(conflict());
    const { result } = setup(save);

    act(() => result.current.changed('mine'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('starts fresh, with nothing to save, when a team is loaded', async () => {
    const save = vi.fn();
    const { result } = setup(save);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.state).toBe('saved');
  });

  it('stops saving when the team is too big for the server', async () => {
    const tooBig = new ApolloError({ graphQLErrors: [new GraphQLError('Too big', { extensions: { code: 'PAYLOAD_TOO_LARGE' } })] });
    const save = vi.fn().mockRejectedValue(tooBig);
    const { result } = setup(save);
    act(() => result.current.changed('huge'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.state).toBe('rejected');
  });

  it('saves again on "Try again" after a failed save', async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApolloError({ networkError: new TypeError('offline') })).mockResolvedValueOnce(6);
    const { result } = setup(save);
    act(() => result.current.changed('one'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('saved');
  });

  it('sends a save whose answer was lost again, unchanged, before the newer change', async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApolloError({ errorMessage: 'offline' })).mockResolvedValueOnce(6).mockResolvedValueOnce(7);
    const { result } = setup(save);
    act(() => result.current.changed('a'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.state).toBe('error');
    act(() => result.current.changed('ab'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save.mock.calls).toEqual([
      ['a', 5],
      ['a', 5],
      ['ab', 6],
    ]);
    expect(result.current.state).toBe('saved');
  });

  it('tries again when the connection comes back, and saves at once when the tab is left', async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApolloError({ errorMessage: 'offline' })).mockResolvedValue(6);
    const { result } = setup(save);
    act(() => result.current.changed('a'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('saved');

    act(() => result.current.changed('ab'));
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(save).toHaveBeenLastCalledWith('ab', 6);
  });
});
