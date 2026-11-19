import { createContext, useContext } from 'react';

import type { MeQuery } from '@graphql/generated/graphql';

export type SessionUser = MeQuery['me'];

/**
 * - checking: asking the API whether there's a session (first load).
 * - unreachable: the API didn't answer, so we can't tell yet.
 */
export type SessionStatus = 'checking' | 'signedIn' | 'signedOut' | 'unreachable';

export type AuthContextValue = {
  user: SessionUser | null;
  status: SessionStatus;
  /** True when the teacher was signed out because their session ended, not by choice. */
  sessionEnded: boolean;
  /** Called after a successful sign-in; the API has already set the cookie. */
  setSession: (user: SessionUser) => void;
  /** Rejects when the API couldn't be reached; the teacher stays signed in. */
  logout: () => Promise<void>;
  /** Asks the API again, e.g. after it was unreachable. */
  recheck: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
