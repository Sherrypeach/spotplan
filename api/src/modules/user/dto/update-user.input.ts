import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateUserInput {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  roleId?: number | null;
}
