// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { useApolloClient } from '@apollo/client';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@context/auth';
import { AuthProvider } from '@context/AuthProvider';
import { Logout, Me } from '@graphql/operations/auth';

const TEACHER = { __typename: 'User', id: 7, email: 'ana@school.org', firstName: 'Ana', lastName: null };
const unauthenticated = [new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } })];

const signedIn: MockedResponse = { request: { query: Me }, result: { data: { me: TEACHER } } };
const noSession: MockedResponse = { request: { query: Me }, result: { errors: unauthenticated } };
const meOffline: MockedResponse = { request: { query: Me }, error: new TypeError('Failed to fetch') };
const logoutOk: MockedResponse = {
  request: { query: Logout },
  result: { data: { logout: { __typename: 'OkResult', ok: true } } },
};
const logoutOffline: MockedResponse = { request: { query: Logout }, error: new TypeError('Failed to fetch') };
const logoutExpired: MockedResponse = { request: { query: Logout }, result: { errors: unauthenticated } };

function Probe() {
  const { status, user, logout } = useAuth();
  const [logoutResult, setLogoutResult] = useState('');
  const handleLogout = () =>
    logout().then(
      () => setLogoutResult('done'),
      () => setLogoutResult('failed'),
    );
  return (
    <>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.firstName ?? ''}</p>
      <p data-testid="logout">{logoutResult}</p>
      <button onClick={() => void handleLogout()}>Sign out</button>
    </>
  );
}

function renderProvider(mocks: MockedResponse[]) {
  render(
    <MockedProvider mocks={mocks}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MockedProvider>,
  );
}

async function expectStatus(status: string) {
  // Generous: with the whole suite running in parallel, the mocked answers can take over a second.
  expect(await screen.findByText(status, { selector: '[data-testid="status"]' }, { timeout: 4000 })).toBeInTheDocument();
}

describe('AuthProvider', () => {
  it('finds an existing session on load', async () => {
    renderProvider([signedIn]);
    expect(screen.getByTestId('status')).toHaveTextContent('checking');
    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent('Ana');
  });

  it('is signed out when the API says there is no session', async () => {
    renderProvider([noSession]);
    await expectStatus('signedOut');
  });

  it('doesn’t claim the manager is signed out when the API can’t be reached', async () => {
    renderProvider([meOffline]);
    await expectStatus('unreachable');
  });

  it('signs out once the API confirms it', async () => {
    renderProvider([signedIn, logoutOk]);
    await expectStatus('signedIn');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await expectStatus('signedOut');
    expect(screen.getByTestId('logout')).toHaveTextContent('done');
  });

  it('stays signed in when sign-out didn’t reach the API', async () => {
    renderProvider([signedIn, logoutOffline]);
    await expectStatus('signedIn');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn');
  });

  it('treats signing out of an already-ended session as signed out', async () => {
    renderProvider([signedIn, logoutExpired]);
    await expectStatus('signedIn');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await expectStatus('signedOut');
  });

  it('empties the cache when coming back finds the session gone', async () => {
    let clearStore: ReturnType<typeof vi.fn> | undefined;
    function CacheSpy() {
      const client = useApolloClient();
      if (!clearStore) clearStore = vi.spyOn(client, 'clearStore') as unknown as ReturnType<typeof vi.fn>;
      return null;
    }
    render(
      <MockedProvider mocks={[signedIn, noSession]}>
        <AuthProvider>
          <CacheSpy />
          <Probe />
        </AuthProvider>
      </MockedProvider>,
    );
    await expectStatus('signedIn');
    const later = Date.now() + 60_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(later);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expectStatus('signedOut');
    expect(clearStore).toHaveBeenCalled();
    now.mockRestore();
  });
});
