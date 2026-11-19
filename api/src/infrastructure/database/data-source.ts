import 'dotenv/config';
import { join } from 'path';

import { DataSource } from 'typeorm';

import { validationSchema } from '../config/validation';

import { postgresSsl } from './ssl';

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate/run/show/revert)
 * and the seeder. Reads and checks the same env the app does; DATABASE_URL wins.
 * Logs the target database (no secrets), so falling back to localhost by mistake shows.
 *
 * This file must export exactly one DataSource: the TypeORM CLI refuses a file
 * with both a named and a default export, and the migration preview then
 * wrongly reports "up to date".
 */
// The migrations and the seeder skip the app's start-up checks, so they run the same ones here.
const { error } = validationSchema.validate(process.env, {
  allowUnknown: true,
});
if (error) throw new Error(`[data-source] ${error.message}`);
const url = process.env.DATABASE_URL || undefined;
if (!url && !process.env.POSTGRES_DB_NAME) {
  throw new Error(
    '[data-source] No database named: set DATABASE_URL, or POSTGRES_DB_NAME with its host and user.',
  );
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(url
    ? { url }
    : {
        host: process.env.POSTGRES_DB_HOST ?? 'localhost',
        port: parseInt(process.env.POSTGRES_DB_PORT ?? '5432'),
        username: process.env.POSTGRES_DB_USER,
        password: process.env.POSTGRES_DB_PASSWORD,
        database: process.env.POSTGRES_DB_NAME,
      }),
  ...postgresSsl(process.env.DATABASE_SSL === 'true'),
  // Relative to this file, so the same data source works from src (ts-node)
  // and from the compiled dist/ on a server without dev dependencies.
  entities: [join(__dirname, '../../modules/**/entities/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
});

const target = url
  ? new URL(url).host + new URL(url).pathname
  : `${process.env.POSTGRES_DB_HOST ?? 'localhost'}:${process.env.POSTGRES_DB_PORT ?? '5432'}/${process.env.POSTGRES_DB_NAME ?? '?'}`;

console.log(`[data-source] target database: ${target}`);
