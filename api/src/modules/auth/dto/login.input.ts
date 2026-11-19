import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_BYTES,
} from '@modules/auth/utils/password-rules';

export class LoginInput {
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsByteLength(0, MAX_PASSWORD_BYTES)
  password: string;
}
