import * as Joi from 'joi';

/**
 * Env validation — add any new .env entry that needs validating.
 * The app refuses to boot on invalid config, which beats failing later.
 */
export const validationSchema = Joi.object({
  // Required: a missing value must not quietly mean the least safe mode.
  NODE_ENV: Joi.string().valid('dev', 'staging', 'prod', 'local').required(),
  PORT: Joi.number(),
  APP_PORT: Joi.number(),
  // Which address to listen on; unset means every address.
  LISTEN_HOST: Joi.string().allow(null, ''),
  APP_NAME: Joi.string().required(),
  APP_VERSION: Joi.string().default('1.0.0'),
  // Reset emails link here, so production must have it.
  WEB_APP_URL: Joi.when('NODE_ENV', {
    is: 'prod',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().allow(null, ''),
  }),
  CORS_ORIGINS: Joi.string().allow(null, ''),

  SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(10),
  // The example file's placeholder is public, so it never counts as a secret.
  JWT_SECRET: Joi.string()
    .min(32)
    .invalid('change-me-to-a-long-random-string')
    .required(),
  SESSION_TTL_HOURS: Joi.number().integer().positive().default(168),
  OTP_TTL_MINUTES: Joi.number().integer().positive().default(15),
  RESET_TOKEN_TTL_MINUTES: Joi.number().integer().positive().default(10),
  // Which proxy may pass on the caller's address (Express "trust proxy").
  TRUST_PROXY: Joi.string().default('loopback'),

  DATABASE_URL: Joi.string().allow(null, ''),
  DATABASE_SSL: Joi.boolean().default(false),
  // Without the provider's certificate, the database's identity isn't checked.
  DATABASE_SSL_CA: Joi.when('NODE_ENV', {
    is: 'prod',
    then: Joi.when('DATABASE_SSL', {
      is: true,
      then: Joi.string().required(),
      otherwise: Joi.string().allow(null, ''),
    }),
    otherwise: Joi.string().allow(null, ''),
  }),
  COOKIE_SECURE: Joi.boolean(),
  POSTGRES_DB_NAME: Joi.string().allow(null, ''),
  POSTGRES_DB_HOST: Joi.string().allow(null, ''),
  POSTGRES_DB_PORT: Joi.number().allow(null, ''),
  POSTGRES_DB_USER: Joi.string().allow(null, ''),
  POSTGRES_DB_PASSWORD: Joi.string().allow(null, ''),

  // Production must send real emails rather than log them.
  // Optional: without a SendGrid key, emails are logged instead of sent.
  SENDGRID_API_KEY: Joi.string().allow(null, ''),
  DEFAULT_EMAIL_FROM: Joi.string().email().allow(null, ''),

  SEED_ADMIN_EMAIL: Joi.string().allow(null, ''),
  SEED_ADMIN_PASSWORD: Joi.string().allow(null, ''),
});
