import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeOrmConfigAsync } from '@infrastructure/database/postgres.config';

@Module({
  imports: [TypeOrmModule.forRootAsync(TypeOrmConfigAsync)],
})
export class DatabaseModule {}
