import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class FilterUsersInput {
  @IsOptional()
  @IsString()
  search?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  roleId?: number | null;
}
