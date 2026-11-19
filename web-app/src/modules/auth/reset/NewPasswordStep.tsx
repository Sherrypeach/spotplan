import { useMutation } from '@apollo/client';
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@components/Button';
import { FormError } from '@components/FormError';
import { PasswordField } from '@components/PasswordField';
import { ResetPassword } from '@graphql/operations/auth';
import { authErrorMessage } from '@modules/auth/authErrorMessage';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@modules/auth/passwordRules';
import { apiErrorCode, isNetworkError } from '@shared/apiErrors';

const CODE_TIMED_OUT = 'That code timed out. Send yourself a new one.';
// The first try may have reached the server even though the answer was lost.
const MAYBE_SAVED = 'Your new password may already be saved. Go back to sign in and try it.';

type Props = {
  resetToken: string;
  onDone: () => void;
  onExpired: (notice: string) => void;
};

export function NewPasswordStep({ resetToken, onDone, onExpired }: Props) {
  const [resetPassword, { loading }] = useMutation(ResetPassword);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [lostAnswer, setLostAnswer] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const problem = passwordProblem(password) ?? undefined;
    setPasswordError(problem);
    if (problem) {
      passwordRef.current?.focus();
      return;
    }
    try {
      await resetPassword({ variables: { resetToken, password } });
      onDone();
    } catch (failure) {
      // The reset token is short-lived and single-use; when it's gone the
      // only way forward is a new code.
      if (apiErrorCode(failure) === 'UNAUTHENTICATED') {
        if (lostAnswer) setError(MAYBE_SAVED);
        else onExpired(CODE_TIMED_OUT);
        return;
      }
      if (isNetworkError(failure)) setLostAnswer(true);
      setError(authErrorMessage(failure, 'We couldn’t save it. Try again.'));
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <PasswordField
        ref={passwordRef}
        label="New password"
        autoComplete="new-password"
        autoFocus
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={passwordError}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <FormError message={error} />
      <Button type="submit" loading={loading}>
        Save password
      </Button>
    </form>
  );
}
