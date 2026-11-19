import {
  IsEmail,
  IsByteLength,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
} from '@modules/auth/utils/password-rules';

export class CreateUserInput {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @IsByteLength(0, MAX_PASSWORD_BYTES)
  password: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  roleId?: number | null;
}
