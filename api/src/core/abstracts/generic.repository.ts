import { DeepPartial } from 'typeorm';

import { PaginationDto } from '@core/dto/pagination.dto';
import { PageResult } from '@core/interfaces/page-result.interface';

/**
 * The standard repository contract. Every module
 * repository implements this via the TypeOrmRepository base class.
 */
export interface GenericRepository<T> {
  findAll(filters?: unknown): Promise<T[]>;
  findAllPaginated(
    pagination?: PaginationDto,
    filters?: unknown,
  ): Promise<PageResult<T>>;
  findById(id: number): Promise<T | null>;
  create(data: DeepPartial<T>): Promise<T>;
  update(id: number, data: DeepPartial<T>): Promise<T | null>;
  delete(id: number): Promise<void>;
}
