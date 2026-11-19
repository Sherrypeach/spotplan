// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ClassroomContext, type ClassroomContextValue } from '@modules/classroom/classroom';
import { ClassSwitcher } from '@modules/classroom/ClassSwitcher';

function renderSwitcher(selectClass = vi.fn(async () => {}), onNewClass = vi.fn()) {
  const value = {
    status: 'ready',
    classes: [
      { id: 1, name: 'Room 12', studentCount: 24 },
      { id: 2, name: '4th grade', studentCount: 18 },
    ],
    current: { id: 1, name: 'Room 12' },
    selectClass,
  } as unknown as ClassroomContextValue;
  render(
    <ClassroomContext.Provider value={value}>
      <ClassSwitcher onNewClass={onNewClass} />
    </ClassroomContext.Provider>,
  );
  return { selectClass, onNewClass };
}

describe('ClassSwitcher', () => {
  it('shows the open team and opens another from the list', async () => {
    const { selectClass } = renderSwitcher();
    const button = screen.getByRole('button', { name: /Room 12/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('button', { name: /4th grade/ }));
    expect(selectClass).toHaveBeenCalledWith(2);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes the list with Escape', async () => {
    renderSwitcher();
    await userEvent.click(screen.getByRole('button', { name: /Room 12/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Room 12/ })).toHaveAttribute('aria-expanded', 'false');
  });
});
