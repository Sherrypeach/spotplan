import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { authErrorMessage, OFFLINE } from '@modules/auth/authErrorMessage';

const FALLBACK = 'That email and password don’t match. Try again.';

function apiError(code: string): ApolloError {
  return new ApolloError({ graphQLErrors: [new GraphQLError('No', { extensions: { code } })] });
}

describe('authErrorMessage', () => {
  it('uses the fallback for a plain refusal', () => {
    expect(authErrorMessage(apiError('UNAUTHENTICATED'), FALLBACK)).toBe(FALLBACK);
  });

  it('asks the manager to wait when tries are rate limited', () => {
    expect(authErrorMessage(apiError('TOO_MANY_REQUESTS'), FALLBACK)).toMatch(/wait a few minutes/i);
  });

  it('blames the connection, not the password, when the server is unreachable', () => {
    const offline = new ApolloError({ networkError: new TypeError('Failed to fetch') });
    expect(authErrorMessage(offline, FALLBACK)).toBe(OFFLINE);
  });

  it('puts the connection first when both went wrong', () => {
    const both = new ApolloError({
      networkError: new TypeError('Failed to fetch'),
      graphQLErrors: [new GraphQLError('No', { extensions: { code: 'TOO_MANY_REQUESTS' } })],
    });
    expect(authErrorMessage(both, FALLBACK)).toBe(OFFLINE);
  });

  it('uses the fallback for anything that is not an API error', () => {
    expect(authErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
