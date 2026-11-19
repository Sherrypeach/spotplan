import { useApolloClient, useMutation } from '@apollo/client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { setSessionExpiredHandler } from '@config/apollo.client';
import { AuthContext, type SessionStatus, type SessionUser } from '@context/auth';
import { Logout, Me } from '@graphql/operations/auth';
import { apiErrorCode } from '@shared/apiErrors';

// Coming back to the tab re-checks the session (it may have ended in another
// tab or on another device), but not more often than this.
const RECHECK_INTERVAL_MS = 15_000;

// Where an older version of the app kept sign-in tokens in the browser.
const OLD_TOKEN_KEYS = ['pd.bearer', 'pd.refresh'];

function forgetOldTokens(): void {
  try {
    OLD_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be blocked (private mode); there's nothing to clean then.
  }
}

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const client = useApolloClient();
  const [logoutMutation] = useMutation(Logout);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [sessionEnded, setSessionEnded] = useState(false);

  // Each check gets a number; a sign-in or a newer check makes older answers stale.
  const checkId = useRef(0);
  const lastCheckAt = useRef(0);
  const signedIn = useRef(false);
  // Whose data the Apollo cache holds; another teacher signing in on this tab clears it.
  const cachedUserId = useRef<SessionUser['id'] | null>(null);

  const startUser = useCallback(
    (sessionUser: SessionUser) => {
      if (cachedUserId.current !== null && cachedUserId.current !== sessionUser.id) void client.clearStore();
      cachedUserId.current = sessionUser.id;
      signedIn.current = true;
      setUser(sessionUser);
      setStatus('signedIn');
    },
    [client],
  );

  const signOutLocally = useCallback(
    (ended: boolean) => {
      checkId.current += 1;
      signedIn.current = false;
      setUser(null);
      setStatus('signedOut');
      setSessionEnded(ended);
      cachedUserId.current = null;
      void client.clearStore();
    },
    [client],
  );

  const checkSession = useCallback(async () => {
    checkId.current += 1;
    const id = checkId.current;
    lastCheckAt.current = Date.now();
    try {
      const { data } = await client.query({ query: Me, fetchPolicy: 'network-only' });
      if (id !== checkId.current) return;
      startUser(data.me);
    } catch (error) {
      if (id !== checkId.current) return;
      if (apiErrorCode(error) === 'UNAUTHENTICATED') {
        // Also empties the cache, so the next teacher on this tab never sees these classes.
        signOutLocally(signedIn.current);
        return;
      }
      // No answer: keep a signed-in teacher where they are; on first load we can't tell.
      if (!signedIn.current) setStatus('unreachable');
    }
  }, [client, startUser, signOutLocally]);

  const setSession = useCallback(
    (sessionUser: SessionUser) => {
      checkId.current += 1;
      startUser(sessionUser);
      setSessionEnded(false);
    },
    [startUser],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation();
    } catch (error) {
      // An already-ended session is as good as signed out; anything else
      // means the server may still hold it, so the teacher stays signed in.
      if (apiErrorCode(error) !== 'UNAUTHENTICATED') throw error;
    }
    signOutLocally(false);
  }, [logoutMutation, signOutLocally]);

  const recheck = useCallback(() => {
    setStatus('checking');
    void checkSession();
  }, [checkSession]);

  const value = useMemo(
    () => ({ user, status, sessionEnded, setSession, logout, recheck }),
    [user, status, sessionEnded, setSession, logout, recheck],
  );

  useEffect(() => {
    forgetOldTokens();
    void checkSession();
  }, [checkSession]);

  useEffect(() => setSessionExpiredHandler(() => signOutLocally(true)), [signOutLocally]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    const handleVisible = () => {
      const due = Date.now() - lastCheckAt.current > RECHECK_INTERVAL_MS;
      if (document.visibilityState === 'visible' && due) void checkSession();
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [status, checkSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
