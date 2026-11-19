import { useMutation } from '@apollo/client';
import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@components/Button';
import { FormError } from '@components/FormError';
import { Notice } from '@components/Notice';
import { PasswordField } from '@components/PasswordField';
import { TextField } from '@components/TextField';
import { TextLink } from '@components/TextLink';
import { useAuth } from '@context/auth';
import { Login as LoginMutation } from '@graphql/operations/auth';
import { AuthCard } from '@modules/auth/AuthCard';
import { authErrorMessage } from '@modules/auth/authErrorMessage';
import { readLoginState, returnPath } from '@modules/auth/loginState';
import { useDocumentTitle } from '@shared/useDocumentTitle';
import { takeUnsavedChanges } from '@shared/unsavedOnSignOut';

type FieldErrors = { email?: string; password?: string };

const WRONG_PASSWORD = 'That email and password don’t match. Try again.';

export function Login() {
  const { setSession, sessionEnded } = useAuth();
  const [lostChanges] = useState(takeUnsavedChanges);
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { loading }] = useMutation(LoginMutation);
  useDocumentTitle('Sign in');

  const handedOver = readLoginState(location.state);
  const [email, setEmail] = useState(handedOver.email ?? '');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const missing: FieldErrors = {
      email: trimmedEmail ? undefined : 'Enter your email.',
      password: password ? undefined : 'Enter your password.',
    };
    setFieldErrors(missing);
    setError(null);
    if (missing.email || missing.password) {
      const firstInvalid = missing.email ? emailRef : passwordRef;
      firstInvalid.current?.focus();
      return;
    }

    try {
      const { data } = await login({ variables: { input: { email: trimmedEmail, password } } });
      if (!data) return;
      setSession(data.login);
      navigate(returnPath(handedOver.from), { replace: true });
    } catch (failure) {
      setError(authErrorMessage(failure, WRONG_PASSWORD));
    }
  };

  return (
    <AuthCard title="Ready to plan your room?" subtitle="Sign in and let’s seat your team.">
      {handedOver.passwordSaved && (
        <Notice tone="success">Your new password is saved. Sign in with it now.</Notice>
      )}
      {sessionEnded && !handedOver.passwordSaved && (
        <Notice>
          {lostChanges
            ? 'You were signed out before your last changes were saved. Sign in again and check your team.'
            : 'You were signed out. Sign in again to pick up where you left off.'}
        </Notice>
      )}
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus={!handedOver.email}
          error={fieldErrors.email}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          autoComplete="current-password"
          autoFocus={Boolean(handedOver.email)}
          error={fieldErrors.password}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="text-center">
        <TextLink to="/auth/reset" state={{ email: email.trim(), from: handedOver.from }}>
          Forgot your password?
        </TextLink>
      </p>
    </AuthCard>
  );
}
