// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@context/auth';
import { SignOutButton } from '@modules/shell/SignOutButton';
import { authValue } from '@test/authMock';
import { emptyDoc } from '@test/classroomDocs';
import { TestClassroom } from '@test/TestClassroom';

vi.mock('@context/auth', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

describe('SignOutButton', () => {
  it('signs out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(authValue({ status: 'signedIn', logout }));
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when signing out didn’t reach the server', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('offline'));
    mockedUseAuth.mockReturnValue(authValue({ status: 'signedIn', logout }));
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t sign you out.');
  });

  it('saves first, and stays signed in if the manager won’t lose unsaved changes', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(authValue({ status: 'signedIn', logout }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const saveNow = vi.fn().mockResolvedValue(false);
    render(
      <TestClassroom initial={emptyDoc()} saveNow={saveNow}>
        <SignOutButton />
      </TestClassroom>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(saveNow).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    expect(logout).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('signs out after saving everything', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(authValue({ status: 'signedIn', logout }));
    const saveNow = vi.fn().mockResolvedValue(true);
    render(
      <TestClassroom initial={emptyDoc()} saveNow={saveNow}>
        <SignOutButton />
      </TestClassroom>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(saveNow).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledOnce();
  });
});
