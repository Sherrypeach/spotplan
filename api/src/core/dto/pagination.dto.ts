import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export enum PaginationOrderDir {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Standard pagination contract. Paginated
 * queries/endpoints reuse this — never invent a parallel shape.
 */
export class PaginationDto {
  /** Page size. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;

  /** pageNumber * pageSize. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /** Property path to order by: 'name', 'user.name'. */
  @IsOptional()
  @IsString()
  orderBy?: string;

  @IsOptional()
  @IsEnum(PaginationOrderDir)
  orderDir?: PaginationOrderDir;
}
