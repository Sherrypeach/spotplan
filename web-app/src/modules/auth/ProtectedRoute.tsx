import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@components/LoadingScreen';
import { useAuth } from '@context/auth';
import type { LoginState } from '@modules/auth/loginState';
import { ServerUnreachable } from '@modules/auth/ServerUnreachable';

/** Lets signed-in teachers through and sends everyone else to sign in, remembering where they were going. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <LoadingScreen />;
  if (status === 'unreachable') {
    return (
      <main className="bg-dots flex min-h-dvh items-center justify-center p-4">
        <ServerUnreachable />
      </main>
    );
  }
  if (status === 'signedOut') {
    const state: LoginState = { from: `${location.pathname}${location.search}` };
    return <Navigate to="/auth/login" replace state={state} />;
  }
  return <Outlet />;
}
