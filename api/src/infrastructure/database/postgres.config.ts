import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';

import { DatabaseConfiguration } from '@infrastructure/config/config.interface';
import { postgresSsl } from '@infrastructure/database/ssl';

/**
 * Runtime TypeORM options. The schema changes only through migrations
 * (`npm run migration:run`), never synchronize.
 */
export function buildTypeOrmOptions(
  db: DatabaseConfiguration,
): TypeOrmModuleOptions {
  const connection = db.url
    ? { url: db.url }
    : {
        host: db.host,
        port: db.port,
        username: db.user,
        password: db.password,
        database: db.name,
      };
  return {
    type: 'postgres',
    ...connection,
    ...postgresSsl(db.ssl),
    autoLoadEntities: true,
    synchronize: false,
  };
}

export const TypeOrmConfigAsync: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => {
    const db = config.get<DatabaseConfiguration>('database');
    if (!db) throw new Error('database configuration missing');
    return buildTypeOrmOptions(db);
  },
  inject: [ConfigService],
};
