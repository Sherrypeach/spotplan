// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@context/auth';
import { AccountMenu } from '@modules/shell/AccountMenu';
import { StepNav } from '@modules/shell/StepNav';
import { TourContext } from '@modules/tour/tour';
import { authValue } from '@test/authMock';
import { docWith, student } from '@test/classroomDocs';
import { TestClassroom } from '@test/TestClassroom';

describe('the steps', () => {
  it('marks the current step and the finished ones, and joins them with lines', () => {
    const doc = docWith([student('a', 'Ann', 2)]);
    render(
      <TestClassroom initial={doc}>
        <MemoryRouter initialEntries={['/room']}>
          <StepNav />
        </MemoryRouter>
      </TestClassroom>,
    );
    expect(screen.getByRole('link', { name: /Room/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Teammates (done)');
    expect(screen.getAllByRole('link')[1]).not.toHaveTextContent('(done)');
    expect(screen.getByRole('navigation', { name: 'Steps' }).querySelectorAll('li[aria-hidden]')).toHaveLength(3);
  });
});

describe('the account menu', () => {
  it('shows who is signed in and starts the tour, dark mode or a new team', async () => {
    const start = vi.fn();
    const onNewClass = vi.fn();
    render(
      <AuthContext.Provider value={authValue()}>
        <TourContext.Provider value={{ start, available: true }}>
          <TestClassroom initial={docWith([])}>
            <AccountMenu onNewClass={onNewClass} />
          </TestClassroom>
        </TourContext.Provider>
      </AuthContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Account/ }));
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New team' }));
    expect(onNewClass).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^Account/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(start).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Take the tour' })).not.toBeInTheDocument();
  });
});
