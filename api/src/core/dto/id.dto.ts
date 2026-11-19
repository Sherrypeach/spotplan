import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

/** Validated `{ id }` param DTO for `:id` routes. */
export class IdDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id: number;
}
