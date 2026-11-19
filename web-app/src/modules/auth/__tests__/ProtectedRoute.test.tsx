// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@context/auth';
import { ProtectedRoute } from '@modules/auth/ProtectedRoute';
import { authValue } from '@test/authMock';
import { LocationProbe } from '@test/LocationProbe';

vi.mock('@context/auth', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/seats" element={<p>Seats page</p>} />
        </Route>
        <Route path="/auth/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => mockedUseAuth.mockReset());

  it('waits while the session is being checked', () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'checking' }));
    renderAt('/seats');
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('shows the page to a signed-in manager', () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'signedIn' }));
    renderAt('/seats');
    expect(screen.getByText('Seats page')).toBeInTheDocument();
  });

  it('sends a signed-out manager to sign in, remembering the page', () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'signedOut' }));
    renderAt('/seats?view=room');
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/login {"from":"/seats?view=room"}');
  });

  it('says it can’t connect instead of asking to sign in when the server is down', async () => {
    const recheck = vi.fn();
    mockedUseAuth.mockReturnValue(authValue({ status: 'unreachable', recheck }));
    renderAt('/seats');
    expect(screen.getByRole('heading', { name: 'We can’t connect right now' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(recheck).toHaveBeenCalledOnce();
  });
});
