import { ApolloError } from '@apollo/client';

/** The API's error code (UNAUTHENTICATED, TOO_MANY_REQUESTS…), if it sent one. */
export function apiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApolloError)) return undefined;
  const code = error.graphQLErrors[0]?.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}

/** True when the request never got an answer from the API (offline, server down). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApolloError && Boolean(error.networkError);
}

/** The API's own message for a request it refused on purpose (BAD_REQUEST), like a limit reached. */
export function refusalMessage(error: unknown): string | undefined {
  if (apiErrorCode(error) !== 'BAD_REQUEST' || !(error instanceof ApolloError)) return undefined;
  return error.graphQLErrors[0]?.message;
}
