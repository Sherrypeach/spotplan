// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClassroomById, MyClassrooms, SaveClassroom } from '@graphql/operations/classroom';
import { useClassroom } from '@modules/classroom/classroom';
import { ClassroomProvider } from '@modules/classroom/ClassroomProvider';
import { addStudents } from '@modules/classroom/rosterEdits';
import { emptyDoc } from '@test/classroomDocs';

const CLASSES = [
  { __typename: 'ClassroomSummary', id: 1, name: 'Room 12', studentCount: 0 },
  { __typename: 'ClassroomSummary', id: 2, name: 'Room 14', studentCount: 0 },
];

const listMock: MockedResponse = { request: { query: MyClassrooms }, result: { data: { myClassrooms: CLASSES } } };

function classMock(id: number, delay = 0): MockedResponse {
  return {
    request: { query: ClassroomById, variables: { id } },
    delay,
    result: { data: { classroom: { __typename: 'Classroom', id, name: `Room ${id}`, revision: 1, document: emptyDoc() } } },
  };
}

let api: ReturnType<typeof useClassroom>;
function Probe() {
  api = useClassroom();
  return <p>{api.current ? `Open: ${api.current.id}` : 'Loading'}</p>;
}

function renderProvider(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <ClassroomProvider>
        <Probe />
      </ClassroomProvider>
    </MockedProvider>,
  );
}

describe('ClassroomProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('opens the team used last on this device', async () => {
    localStorage.setItem('seating.lastClass', '2');
    renderProvider([listMock, classMock(2)]);
    expect(await screen.findByText('Open: 2')).toBeInTheDocument();
  });

  it('keeps only the team opened last when two open at once', async () => {
    renderProvider([listMock, classMock(1), classMock(2, 50), classMock(1)]);
    await screen.findByText('Open: 1');
    await act(async () => {
      void api.selectClass(2);
    });
    await act(async () => {
      void api.selectClass(1);
    });
    // The slow answer for class 2 arrives after class 1 and must not win.
    await waitFor(() => expect(api.current?.id).toBe(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 60)));
    expect(screen.getByText('Open: 1')).toBeInTheDocument();
  });

  it('asks before switching team when a change couldn’t be saved', async () => {
    const failedSave: MockedResponse = {
      request: { query: SaveClassroom },
      variableMatcher: () => true,
      error: new Error('offline'),
    };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderProvider([listMock, classMock(1), failedSave]);
    await screen.findByText('Open: 1');

    act(() => api.update((doc) => addStudents(doc, [{ name: 'Ava', level: null, color: null }]).doc));
    await act(() => api.selectClass(2));

    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(api.saveState).toBe('error'));
    expect(screen.getByText('Open: 1')).toBeInTheDocument();
  });

  it('opens the other team when the manager agrees to lose the unsaved change', async () => {
    const failedSave: MockedResponse = {
      request: { query: SaveClassroom },
      variableMatcher: () => true,
      error: new Error('offline'),
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderProvider([listMock, classMock(1), failedSave, classMock(2)]);
    await screen.findByText('Open: 1');

    act(() => api.update((doc) => addStudents(doc, [{ name: 'Ava', level: null, color: null }]).doc));
    await act(() => api.selectClass(2));
    expect(await screen.findByText('Open: 2')).toBeInTheDocument();
  });

  it('ignores edits once the server has refused the team', async () => {
    const refused: MockedResponse = {
      request: { query: SaveClassroom },
      variableMatcher: () => true,
      result: { errors: [new GraphQLError('Too big', { extensions: { code: 'PAYLOAD_TOO_LARGE' } })] },
    };
    renderProvider([listMock, classMock(1), refused]);
    await screen.findByText('Open: 1');

    act(() => api.update((doc) => addStudents(doc, [{ name: 'Ava', level: null, color: null }]).doc));
    await act(async () => {
      await api.saveNow();
    });
    expect(api.saveState).toBe('rejected');

    act(() => api.update((doc) => addStudents(doc, [{ name: 'Ben', level: null, color: null }]).doc));
    expect(api.doc?.students.map((s) => s.name)).toEqual(['Ava']);
  });
});
