import { isAuthPath } from '@shared/authPath';
/** What other pages hand to the sign-in page through the router's location state. */
export type LoginState = {
  /** The page the teacher was trying to open. */
  from?: string;
  /** Set after a password reset, to confirm it and fill in the email. */
  passwordSaved?: boolean;
  email?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads location state defensively: it survives reloads and can be anything. */
export function readLoginState(state: unknown): LoginState {
  if (!isRecord(state)) return {};
  return {
    from: typeof state.from === 'string' ? state.from : undefined,
    passwordSaved: state.passwordSaved === true,
    email: typeof state.email === 'string' ? state.email : undefined,
  };
}

/**
 * Where to go after signing in. Only paths inside this app are allowed, so a
 * crafted link can't send the teacher to another site ("//evil.example").
 */
export function returnPath(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || isAuthPath(from)) return '/';
  return from;
}
