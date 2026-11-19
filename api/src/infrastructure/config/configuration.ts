import {
  AppConfiguration,
  AppEnvironment,
  DatabaseConfiguration,
  EmailConfiguration,
} from '@infrastructure/config/config.interface';

/**
 * Typed configuration factory (https://docs.nestjs.com/techniques/configuration).
 * PORT (injected by the platform's PM2 process) wins over APP_PORT.
 */
export default () => {
  // validation.ts requires NODE_ENV; if it were ever missing, assume production
  // (Secure cookies, no stack traces) rather than local.
  const env =
    (process.env.NODE_ENV as AppEnvironment) ?? AppEnvironment.Production;
  const app: AppConfiguration = {
    env,
    port: parseInt(process.env.PORT ?? process.env.APP_PORT ?? '3000'),
    listenHost: process.env.LISTEN_HOST || undefined,
    name: process.env.APP_NAME,
    version: process.env.APP_VERSION,
    // No trailing slash, so links like `${webUrl}/auth/reset` come out right.
    webUrl: process.env.WEB_APP_URL?.replace(/\/+$/, ''),
    corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    saltRounds: parseInt(process.env.SALT_ROUNDS ?? '10'),
    jwtSecret: process.env.JWT_SECRET ?? '',
    sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS ?? '168'),
    // Secure everywhere but local. COOKIE_SECURE=false lets a dev server reached
    // over plain http on a private network keep its session;
    // production ignores it.
    secureCookies:
      env === AppEnvironment.Production ||
      (env !== AppEnvironment.Local && process.env.COOKIE_SECURE !== 'false'),
    otpTtlMinutes: parseInt(process.env.OTP_TTL_MINUTES ?? '15'),
    resetTokenTtlMinutes: parseInt(process.env.RESET_TOKEN_TTL_MINUTES ?? '10'),
    trustProxy: process.env.TRUST_PROXY ?? 'loopback',
  };

  const database: DatabaseConfiguration = {
    url: process.env.DATABASE_URL || undefined,
    name: process.env.POSTGRES_DB_NAME,
    host: process.env.POSTGRES_DB_HOST,
    port: parseInt(process.env.POSTGRES_DB_PORT ?? '5432'),
    user: process.env.POSTGRES_DB_USER,
    password: process.env.POSTGRES_DB_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true',
  };

  const email: EmailConfiguration = {
    sendgridApiKey: process.env.SENDGRID_API_KEY || undefined,
    defaultFrom: process.env.DEFAULT_EMAIL_FROM,
  };

  return { app, database, email };
};
