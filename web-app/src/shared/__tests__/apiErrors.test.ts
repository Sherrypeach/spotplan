import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { apiErrorCode, isNetworkError } from '@shared/apiErrors';

function apiError(code: unknown): ApolloError {
  return new ApolloError({ graphQLErrors: [new GraphQLError('No', { extensions: { code } })] });
}

describe('apiErrorCode', () => {
  it('reads the code the API sent', () => {
    expect(apiErrorCode(apiError('UNAUTHENTICATED'))).toBe('UNAUTHENTICATED');
  });

  it('ignores a code that is not text', () => {
    expect(apiErrorCode(apiError(401))).toBeUndefined();
  });

  it('is undefined for errors that did not come from the API', () => {
    expect(apiErrorCode(new Error('boom'))).toBeUndefined();
  });
});

describe('isNetworkError', () => {
  it('is true when the request got no answer', () => {
    expect(isNetworkError(new ApolloError({ networkError: new TypeError('Failed to fetch') }))).toBe(true);
  });

  it('is false when the API answered with an error', () => {
    expect(isNetworkError(apiError('UNAUTHENTICATED'))).toBe(false);
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });
});
