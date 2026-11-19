import { ApolloLink, execute, gql, Observable, type FetchResult } from '@apollo/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionErrorLink, setSessionExpiredHandler } from '@config/apollo.client';

function failingWith(code: string): ApolloLink {
  return new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        observer.next({ errors: [{ message: 'No', extensions: { code } }] } as FetchResult);
        observer.complete();
      }),
  );
}

async function run(operationName: string, code: string): Promise<void> {
  const query = gql(`query ${operationName} { me { id } }`);
  await new Promise<void>((resolve) => {
    execute(ApolloLink.from([sessionErrorLink, failingWith(code)]), { query }).subscribe({
      complete: resolve,
      error: () => resolve(),
    });
  });
}

describe('sessionErrorLink', () => {
  let unregister = () => {};
  afterEach(() => unregister());

  it('reports an expired session from a signed-in request', async () => {
    const handler = vi.fn();
    unregister = setSessionExpiredHandler(handler);
    await run('MyClassrooms', 'UNAUTHENTICATED');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignores a wrong password or code, which also say UNAUTHENTICATED', async () => {
    const handler = vi.fn();
    unregister = setSessionExpiredHandler(handler);
    for (const name of ['Login', 'Me', 'Logout', 'ValidateOtp', 'ResetPassword']) {
      await run(name, 'UNAUTHENTICATED');
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores other errors', async () => {
    const handler = vi.fn();
    unregister = setSessionExpiredHandler(handler);
    await run('MyClassrooms', 'NOT_FOUND');
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops reporting once the handler is removed', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler)();
    await run('MyClassrooms', 'UNAUTHENTICATED');
    expect(handler).not.toHaveBeenCalled();
  });
});
