import { IconWifiOff } from '@tabler/icons-react';

import { Button } from '@components/Button';
import { useAuth } from '@context/auth';
import { AuthCard } from '@modules/auth/AuthCard';
import { useDocumentTitle } from '@shared/useDocumentTitle';

/** Shown when the server didn't answer on page load, so we can't tell if the teacher is signed in. */
export function ServerUnreachable() {
  const { recheck } = useAuth();
  useDocumentTitle('Can’t connect');

  return (
    <AuthCard title="We can’t connect right now" subtitle="Check your internet connection, then try again.">
      <IconWifiOff className="mx-auto size-12 text-ink-muted" aria-hidden />
      <Button onClick={recheck}>Try again</Button>
    </AuthCard>
  );
}
