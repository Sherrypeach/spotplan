export enum AppEnvironment {
  Development = 'dev',
  Staging = 'staging',
  Production = 'prod',
  Local = 'local',
}

export interface AppConfiguration {
  env: AppEnvironment;
  port: number;
  /** Address to listen on; undefined means every address. */
  listenHost: string | undefined;
  name: string | undefined;
  version: string | undefined;
  webUrl: string | undefined;
  corsOrigins: string[];
  saltRounds: number;
  jwtSecret: string;
  sessionTtlHours: number;
  /** Cookies only travel over HTTPS outside local development. */
  secureCookies: boolean;
  otpTtlMinutes: number;
  resetTokenTtlMinutes: number;
  /** Which proxy may pass on the caller's address. */
  trustProxy: string;
}

export interface DatabaseConfiguration {
  /** Full connection string — wins over the discrete fields when set. */
  url: string | undefined;
  name: string | undefined;
  host: string | undefined;
  port: number;
  user: string | undefined;
  password: string | undefined;
  /** Managed Postgres (e.g. DigitalOcean) requires TLS — set DATABASE_SSL=true. */
  ssl: boolean;
}

export interface EmailConfiguration {
  sendgridApiKey: string | undefined;
  defaultFrom: string | undefined;
}
