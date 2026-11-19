import {
  DeepPartial,
  FindOptionsOrder,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';

import { BaseModel } from '@core/models/base.model';
import { PaginationDto, PaginationOrderDir } from '@core/dto/pagination.dto';
import { PageResult } from '@core/interfaces/page-result.interface';

const DEFAULT_PAGE_SIZE = 25;

/**
 * Base class every module repository extends.
 * The ONLY layer that talks to TypeORM. Subclasses declare the default
 * `relations` to load and implement `parseFilters` to translate a
 * Filter<Entity>Input into a TypeORM where clause.
 */
export abstract class TypeOrmRepository<T extends BaseModel & ObjectLiteral> {
  /** Default relations loaded with the entity — explicit, per repository. */
  protected relations: string[] = [];

  constructor(protected readonly repository: Repository<T>) {}

  /** Translate a module Filter input into a TypeORM where clause. */
  protected parseFilters(_filters?: unknown): FindOptionsWhere<T> {
    return {};
  }

  /** 'user.name' + DESC → { user: { name: 'DESC' } } */
  protected parseOrder(
    pagination?: PaginationDto,
  ): FindOptionsOrder<T> | undefined {
    if (!pagination?.orderBy) return undefined;
    const dir = pagination.orderDir ?? PaginationOrderDir.ASC;
    return pagination.orderBy
      .split('.')
      .reverse()
      .reduce<unknown>(
        (acc, key) => ({ [key]: acc }),
        dir,
      ) as FindOptionsOrder<T>;
  }

  findAll(filters?: unknown): Promise<T[]> {
    return this.repository.find({
      where: this.parseFilters(filters),
      relations: this.relations,
    });
  }

  async findAllPaginated(
    pagination?: PaginationDto,
    filters?: unknown,
  ): Promise<PageResult<T>> {
    const limit = pagination?.limit ?? DEFAULT_PAGE_SIZE;
    const skip = pagination?.skip ?? 0;
    const [items, total] = await this.repository.findAndCount({
      where: this.parseFilters(filters),
      relations: this.relations,
      order: this.parseOrder(pagination),
      take: limit,
      skip,
    });
    return { items, total, limit, skip };
  }

  findById(id: number): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations: this.relations,
    });
  }

  findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOne({ where, relations: this.relations });
  }

  create(data: DeepPartial<T>): Promise<T> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    // Entities with a @DeleteDateColumn are soft-deleted; hard-delete otherwise.
    if (this.repository.metadata.deleteDateColumn) {
      await this.repository.softDelete(id);
    } else {
      await this.repository.delete(id);
    }
  }
}
