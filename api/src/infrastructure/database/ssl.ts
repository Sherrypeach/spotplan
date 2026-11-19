import { readFileSync } from 'fs';

/**
 * TLS settings for Postgres. With DATABASE_SSL_CA (the path to the provider's
 * CA certificate) the server's certificate is checked; without it the
 * connection is encrypted but not verified, which only suits development.
 */
export function postgresSsl(
  enabled: boolean,
  caPath = process.env.DATABASE_SSL_CA,
): { ssl: { ca?: string; rejectUnauthorized: boolean } } | object {
  if (!enabled) return {};
  if (caPath) {
    return {
      ssl: { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    };
  }
  return { ssl: { rejectUnauthorized: false } };
}
