import { useMutation } from '@apollo/client';
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@components/Button';
import { FormError } from '@components/FormError';
import { Notice } from '@components/Notice';
import { TextField } from '@components/TextField';
import { ForgotPassword } from '@graphql/operations/auth';
import { authErrorMessage } from '@modules/auth/authErrorMessage';

type Props = {
  initialEmail: string;
  /** Shown when the teacher was sent back here, e.g. after a code timed out. */
  notice?: string;
  onSent: (email: string) => void;
  /** For a teacher who already has a code in their inbox. */
  onHaveCode: (email: string) => void;
};

export function EmailStep({ initialEmail, notice, onSent, onHaveCode }: Props) {
  const [forgotPassword, { loading }] = useMutation(ForgotPassword);
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Returns the trimmed email, or null after pointing the teacher at the empty field.
  const requireEmail = (): string | null => {
    const trimmed = email.trim();
    setEmailError(trimmed ? undefined : 'Enter your email.');
    if (!trimmed) emailRef.current?.focus();
    return trimmed || null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = requireEmail();
    if (!trimmed) return;
    try {
      await forgotPassword({ variables: { email: trimmed } });
      onSent(trimmed);
    } catch (failure) {
      setError(authErrorMessage(failure, 'We couldn’t send the code. Try again.'));
    }
  };

  const handleHaveCode = () => {
    const trimmed = requireEmail();
    if (trimmed) onHaveCode(trimmed);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {notice && <Notice>{notice}</Notice>}
      <TextField
        ref={emailRef}
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        error={emailError}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormError message={error} />
      <Button type="submit" loading={loading}>
        Send me a code
      </Button>
      <Button variant="secondary" onClick={handleHaveCode}>
        I already have a code
      </Button>
    </form>
  );
}
