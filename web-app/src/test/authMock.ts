import { vi } from 'vitest';

import type { AuthContextValue } from '@context/auth';

/** A useAuth() value for component tests; pass only what the test cares about. */
export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    status: 'signedOut',
    sessionEnded: false,
    setSession: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    recheck: vi.fn(),
    ...overrides,
  };
}
