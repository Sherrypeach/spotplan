// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@context/auth';
import { Login as LoginMutation } from '@graphql/operations/auth';
import { Login } from '@modules/auth/Login';
import { authValue } from '@test/authMock';
import { LocationProbe } from '@test/LocationProbe';

vi.mock('@context/auth', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

const EMAIL = 'ana@school.org';
const PASSWORD = 'correct horse';
const TEACHER = { __typename: 'User' as const, id: 7, email: EMAIL, firstName: 'Ana', lastName: null };

function loginMock(result: MockedResponse['result'] | { errors: GraphQLError[] }): MockedResponse {
  return {
    request: { query: LoginMutation, variables: { input: { email: EMAIL, password: PASSWORD } } },
    result,
  } as MockedResponse;
}

function renderLogin(mocks: MockedResponse[], state?: unknown) {
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state }]}>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('Login', () => {
  const setSession = vi.fn();

  beforeEach(() => {
    setSession.mockReset();
    mockedUseAuth.mockReturnValue(authValue({ setSession }));
  });

  it('points at the empty fields instead of asking the server', async () => {
    renderLogin([]);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAccessibleDescription('Enter your email.');
    expect(email).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
  });

  it('signs in and returns to the page the manager was opening', async () => {
    renderLogin([loginMock({ data: { login: TEACHER } })], { from: '/seats' });
    await userEvent.type(screen.getByLabelText('Email'), ` ${EMAIL} `);
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/seats');
    expect(setSession).toHaveBeenCalledWith(TEACHER);
  });

  it('says plainly when the email and password don’t match', async () => {
    const refused = new GraphQLError('No', { extensions: { code: 'UNAUTHENTICATED' } });
    renderLogin([loginMock({ errors: [refused] })]);
    await userEvent.type(screen.getByLabelText('Email'), EMAIL);
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match.');
    expect(setSession).not.toHaveBeenCalled();
  });

  it('confirms a new password and fills in the email after a reset', () => {
    renderLogin([], { passwordSaved: true, email: EMAIL });
    expect(screen.getByText('Your new password is saved. Sign in with it now.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL);
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('explains why a manager whose session ended is back here', () => {
    mockedUseAuth.mockReturnValue(authValue({ sessionEnded: true }));
    renderLogin([]);
    expect(screen.getByText(/You were signed out/)).toBeInTheDocument();
  });

  it('shows and hides the password', async () => {
    renderLogin([]);
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
