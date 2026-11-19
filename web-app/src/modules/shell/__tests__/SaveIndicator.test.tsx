// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ClassroomContext, type ClassroomContextValue, type SaveState } from '@modules/classroom/classroom';
import { SaveIndicator, SaveProblems } from '@modules/shell/SaveIndicator';
import { emptyDoc } from '@test/classroomDocs';

function renderIndicator(saveState: SaveState) {
  const value: ClassroomContextValue = {
    status: 'ready',
    classes: [],
    current: { id: 1, name: 'Room 12' },
    doc: emptyDoc(),
    update: () => true,
    saveState,
    retrySave: vi.fn(),
    saveNow: async () => true,
    selectClass: async () => {},
    createClass: async () => true,
    reload: vi.fn(),
    loads: 1,
  };
  render(
    <ClassroomContext.Provider value={value}>
      <SaveIndicator />
      <SaveProblems />
    </ClassroomContext.Provider>,
  );
  return value;
}

describe('SaveIndicator', () => {
  it('says Saved quietly when all is well', () => {
    renderIndicator('saved');
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers to try again when a save didn’t reach the server', async () => {
    const value = renderIndicator('error');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(value.retrySave).toHaveBeenCalledOnce();
  });

  it('offers to load the latest after a conflict', async () => {
    const value = renderIndicator('conflict');
    expect(screen.getByRole('alert')).toHaveTextContent('changed somewhere else');
    await userEvent.click(screen.getByRole('button', { name: 'Load the latest' }));
    expect(value.reload).toHaveBeenCalledOnce();
  });

  it('offers to load the team again when the server refused it', async () => {
    const value = renderIndicator('rejected');
    await userEvent.click(screen.getByRole('button', { name: 'Load the team again' }));
    expect(value.reload).toHaveBeenCalledOnce();
  });

  it('shows only a short "Not saved" in the bar, with the full message below it', () => {
    renderIndicator('error');
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
