import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { TextLink } from '@components/TextLink';
import { AuthCard } from '@modules/auth/AuthCard';
import { readLoginState, type LoginState } from '@modules/auth/loginState';
import { CodeStep } from '@modules/auth/reset/CodeStep';
import { EmailStep } from '@modules/auth/reset/EmailStep';
import { NewPasswordStep } from '@modules/auth/reset/NewPasswordStep';
import { useDocumentTitle } from '@shared/useDocumentTitle';

type StageName = 'email' | 'code' | 'password';

const SUBTITLES: Record<StageName, string> = {
  email: 'We’ll email you a 6-digit code.',
  code: 'Check your email for the 6-digit code.',
  password: 'Choose a new password.',
};

function readStage(state: unknown): StageName {
  const stage = typeof state === 'object' && state !== null ? (state as { stage?: unknown }).stage : undefined;
  return stage === 'code' || stage === 'password' ? stage : 'email';
}

/**
 * Email → 6-digit code → new password, following the API's reset flow. Each
 * stage is a history entry, so the browser's Back button steps back through
 * them; the reset token itself stays in memory only.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentTitle('Reset your password');

  const handedOver = readLoginState(location.state);
  const email = handedOver.email ?? '';
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  // Without a token (e.g. the page was reloaded), the password stage can't work.
  const requested = readStage(location.state);
  const stage: StageName = requested === 'password' && !resetToken ? 'code' : requested;

  const goTo = (next: StageName, nextEmail = email) =>
    navigate('/auth/reset', { state: { stage: next, email: nextEmail, from: handedOver.from } });

  const goToCode = (confirmedEmail: string) => {
    setNotice(undefined);
    goTo('code', confirmedEmail);
  };

  const handleDone = () => {
    const state: LoginState = { passwordSaved: true, email, from: handedOver.from };
    navigate('/auth/login', { replace: true, state });
  };

  return (
    <AuthCard title="Reset your password" subtitle={SUBTITLES[stage]}>
      {stage === 'email' && <EmailStep initialEmail={email} notice={notice} onSent={goToCode} onHaveCode={goToCode} />}
      {stage === 'code' && (
        <CodeStep
          email={email}
          onVerified={(token) => {
            setResetToken(token);
            goTo('password');
          }}
          onChangeEmail={() => goTo('email')}
        />
      )}
      {stage === 'password' && resetToken && (
        <NewPasswordStep
          resetToken={resetToken}
          onDone={handleDone}
          onExpired={(message) => {
            setResetToken(null);
            setNotice(message);
            goTo('email');
          }}
        />
      )}
      <p className="text-center">
        <TextLink to="/auth/login">Back to sign in</TextLink>
      </p>
    </AuthCard>
  );
}
