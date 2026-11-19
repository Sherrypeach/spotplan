// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ForgotPassword, ResetPassword as ResetPasswordMutation, ValidateOtp } from '@graphql/operations/auth';
import { ResetPassword } from '@modules/auth/reset/ResetPassword';
import { LocationProbe } from '@test/LocationProbe';

const EMAIL = 'ana@school.org';
const CODE = '123456';
const TOKEN = 'reset-token';
const NEW_PASSWORD = 'a new password';

const sendCode: MockedResponse = {
  request: { query: ForgotPassword, variables: { email: EMAIL } },
  result: { data: { forgotPassword: { __typename: 'OkResult', ok: true } } },
};
const checkCode: MockedResponse = {
  request: { query: ValidateOtp, variables: { email: EMAIL, otp: CODE } },
  result: { data: { validateOtp: { __typename: 'ResetToken', resetToken: TOKEN } } },
};
const savePassword: MockedResponse = {
  request: { query: ResetPasswordMutation, variables: { resetToken: TOKEN, password: NEW_PASSWORD } },
  result: { data: { resetPassword: { __typename: 'OkResult', ok: true } } },
};
const tokenExpired: MockedResponse = {
  request: savePassword.request,
  result: { errors: [new GraphQLError('Invalid reset token', { extensions: { code: 'UNAUTHENTICATED' } })] },
};

/** Stands in for the browser's Back button. */
function BrowserBack() {
  const navigate = useNavigate();
  return <button onClick={() => void navigate(-1)}>Browser back</button>;
}

function renderReset(mocks: MockedResponse[], state?: unknown) {
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[{ pathname: '/auth/reset', state }]}>
        <BrowserBack />
        <Routes>
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

async function reachPasswordStep() {
  await userEvent.type(screen.getByLabelText('Email'), EMAIL);
  await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
  const code = await screen.findByLabelText('6-digit code');
  expect(code).toHaveFocus();
  await userEvent.type(code, '123 456');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  return screen.findByLabelText('New password');
}

describe('ResetPassword', () => {
  it('goes email → code → new password, then confirms on the sign-in page', async () => {
    renderReset([sendCode, checkCode, savePassword]);
    const password = await reachPasswordStep();
    expect(password).toHaveFocus();

    await userEvent.type(password, 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(password).toHaveAccessibleDescription(/Use at least 8 characters/);

    await userEvent.clear(password);
    await userEvent.type(password, NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      `/auth/login {"passwordSaved":true,"email":"${EMAIL}"}`,
    );
  });

  it('sends the manager back for a new code when the old one timed out, keeping the email', async () => {
    renderReset([sendCode, checkCode, tokenExpired]);
    await userEvent.type(await reachPasswordStep(), NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByText('That code timed out. Send yourself a new one.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL);
  });

  it('lets a manager who already has a code skip sending another', async () => {
    renderReset([]);
    await userEvent.type(screen.getByLabelText('Email'), EMAIL);
    await userEvent.click(screen.getByRole('button', { name: 'I already have a code' }));
    expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument();
  });

  it('can go back to fix the email', async () => {
    renderReset([sendCode]);
    await userEvent.type(screen.getByLabelText('Email'), EMAIL);
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL);
  });

  it('steps back through the stages with the browser’s Back button', async () => {
    renderReset([sendCode]);
    await userEvent.type(screen.getByLabelText('Email'), EMAIL);
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    await screen.findByLabelText('6-digit code');
    await userEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  });

  it('keeps the page the manager was heading to', async () => {
    renderReset([sendCode, checkCode, savePassword], { email: EMAIL, from: '/seats' });
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    await userEvent.type(await screen.findByLabelText('6-digit code'), CODE);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(await screen.findByLabelText('New password'), NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('"from":"/seats"');
  });
});
