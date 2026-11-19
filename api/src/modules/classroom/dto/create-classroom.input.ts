import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { trimString } from '@core/utils/transforms';
import { MAX_CLASS_NAME } from '@modules/classroom/utils/classroom-limits';

const keepAsIs = ({ obj }: { obj: Record<string, unknown> }) => obj.document;

export class CreateClassroomInput {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CLASS_NAME)
  name: string;

  /** A backup or the example class; a new empty class when left out. */
  @IsOptional()
  @IsObject()
  // Checked field by field in the service; passed through untouched here.
  @Transform(keepAsIs)
  document?: Record<string, unknown>;
}
