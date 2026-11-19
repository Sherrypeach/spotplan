import { useMutation } from '@apollo/client';
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@components/Button';
import { FormError } from '@components/FormError';
import { Notice } from '@components/Notice';
import { TextField } from '@components/TextField';
import { ForgotPassword, ValidateOtp } from '@graphql/operations/auth';
import { authErrorMessage } from '@modules/auth/authErrorMessage';
import { CODE_LENGTH, cleanCode } from '@modules/auth/reset/resetCode';
import { useCooldown } from '@modules/auth/reset/useCooldown';

// Long enough that a code isn't re-sent before the first one arrives.
const RESEND_WAIT_SECONDS = 30;

type Props = {
  email: string;
  onVerified: (resetToken: string) => void;
  onChangeEmail: () => void;
};

export function CodeStep({ email, onVerified, onChangeEmail }: Props) {
  const [validateOtp, { loading }] = useMutation(ValidateOtp);
  const [forgotPassword, { loading: resending }] = useMutation(ForgotPassword);
  const resendWait = useCooldown(RESEND_WAIT_SECONDS);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const complete = code.length === CODE_LENGTH;
    setCodeError(complete ? undefined : 'Enter the 6-digit code from the email.');
    if (!complete) {
      codeRef.current?.focus();
      return;
    }
    try {
      const { data } = await validateOtp({ variables: { email, otp: code } });
      if (data) onVerified(data.validateOtp.resetToken);
    } catch (failure) {
      setError(authErrorMessage(failure, 'That code didn’t work. Check it, or send a new code.'));
    }
  };

  const handleResend = async () => {
    setError(null);
    setResent(false);
    try {
      await forgotPassword({ variables: { email } });
      setCode('');
      setResent(true);
      resendWait.start();
      codeRef.current?.focus();
    } catch (failure) {
      setError(authErrorMessage(failure, 'We couldn’t send a new code. Try again.'));
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <p className="text-center text-base text-ink-muted">
        If <span className="font-semibold text-ink">{email}</span> has an account, a code is on its way. It can
        take a minute. Check your junk or spam folder too.
      </p>
      {resent && <Notice tone="success">A new code is on its way. Use the newest email.</Notice>}
      <TextField
        ref={codeRef}
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        className="[&_input]:text-center [&_input]:indent-[0.5em] [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        error={codeError}
        value={code}
        onChange={(event) => setCode(cleanCode(event.target.value))}
      />
      <FormError message={error} />
      <Button type="submit" loading={loading}>
        Continue
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          className="flex-1"
          loading={resending}
          onClick={handleResend}
          disabled={resendWait.active}
        >
          {resendWait.active ? `Send a new code (${resendWait.secondsLeft})` : 'Send a new code'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
    </form>
  );
}
