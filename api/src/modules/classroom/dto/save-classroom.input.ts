import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

import { trimString } from '@core/utils/transforms';
import { MAX_CLASS_NAME } from '@modules/classroom/utils/classroom-limits';

const keepAsIs = ({ obj }: { obj: Record<string, unknown> }) => obj.document;

export class SaveClassroomInput {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CLASS_NAME)
  name?: string;

  // Checked field by field in the service; passed through untouched here.
  @IsObject()
  @Transform(keepAsIs)
  document: Record<string, unknown>;

  /** The revision the teacher's screen loaded. */
  @IsInt()
  @IsPositive()
  revision: number;
}
