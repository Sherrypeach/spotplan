import { ApolloClient, from, HttpLink, InMemoryCache } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// The API is reached through this app's own /api proxy, so the browser sends
// the httpOnly session cookie with every request and scripts never see it.
const GRAPHQL_URL = '/api/graphql';

// The API refuses writes without this header; another site can't add it.
const CLIENT_HEADER = { 'x-seating-client': 'web' };

// Operations that work without a session. When they fail with
// UNAUTHENTICATED it means a wrong password or code, not an expired session.
const PUBLIC_OPERATIONS = new Set(['Login', 'Logout', 'Me', 'ForgotPassword', 'ValidateOtp', 'ResetPassword']);

let onSessionExpired: () => void = () => {};

/** Lets the auth provider hear about an expired session from any request. Returns an unregister function. */
export function setSessionExpiredHandler(handler: () => void): () => void {
  onSessionExpired = handler;
  return () => {
    if (onSessionExpired === handler) onSessionExpired = () => {};
  };
}

export const sessionErrorLink = onError(({ graphQLErrors, operation }) => {
  const unauthenticated = graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED');
  if (unauthenticated && !PUBLIC_OPERATIONS.has(operation.operationName)) {
    onSessionExpired();
  }
});

const httpLink = new HttpLink({
  uri: GRAPHQL_URL,
  credentials: 'same-origin',
  headers: CLIENT_HEADER,
});

export const apolloClient = new ApolloClient({
  link: from([sessionErrorLink, httpLink]),
  cache: new InMemoryCache(),
});
