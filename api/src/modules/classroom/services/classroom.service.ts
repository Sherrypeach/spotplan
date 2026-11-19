import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { ClassroomRepository } from '@modules/classroom/classroom.repository';
import { CreateClassroomInput } from '@modules/classroom/dto/create-classroom.input';
import { SaveClassroomInput } from '@modules/classroom/dto/save-classroom.input';
import { Classroom } from '@modules/classroom/entities/classroom.entity';
import { ClassroomDocument } from '@modules/classroom/interfaces/classroom-document.interface';
import { parseClassroomDocument } from '@modules/classroom/utils/classroom-document.validator';
import {
  MAX_CLASSES_PER_TEACHER,
  MAX_DOCUMENT_CHARS,
} from '@modules/classroom/utils/classroom-limits';
import { newClassroomDocument } from '@modules/classroom/utils/new-classroom-document';

@Injectable()
export class ClassroomService {
  constructor(private readonly repository: ClassroomRepository) {}

  findMine(teacherId: number): Promise<Classroom[]> {
    return this.repository.findSummariesByTeacher(teacherId);
  }

  async findOne(id: number, teacherId: number): Promise<Classroom> {
    const classroom = await this.repository.findOwned(id, teacherId);
    if (!classroom) throw new NotFoundException('Class not found');
    return classroom;
  }

  /** A new class, empty or from a backup (which is checked like any save). */
  async create(
    teacherId: number,
    input: CreateClassroomInput,
  ): Promise<Classroom> {
    const document = input.document
      ? this.checked(input.document)
      : newClassroomDocument();
    const created = await this.repository.createWithinLimit(
      { teacherId, name: input.name, document, revision: 1 },
      MAX_CLASSES_PER_TEACHER,
    );
    if (!created) {
      throw new BadRequestException(
        `You can have up to ${MAX_CLASSES_PER_TEACHER} classes.`,
      );
    }
    return created;
  }

  /** Saves the teacher's changes unless the class changed since it was loaded. */
  async save(
    id: number,
    teacherId: number,
    input: SaveClassroomInput,
  ): Promise<Pick<Classroom, 'id' | 'name' | 'revision' | 'document'>> {
    const document = this.checked(input.document);
    const saved = await this.repository.saveIfRevision(
      id,
      teacherId,
      input.revision,
      { name: input.name, document },
    );
    if (saved) return { id, ...saved, document };

    // Not saved: someone else's class, a lost answer to this same save being
    // sent again, or a real conflict.
    const current = await this.findOne(id, teacherId);
    const retried =
      input.name === undefined || input.name === current.name
        ? await this.repository.isAlreadySaved(
            id,
            teacherId,
            input.revision,
            document,
          )
        : false;
    if (retried) return current;
    throw new ConflictException(
      'This class was changed somewhere else. Reload to see the latest version.',
    );
  }

  /** Deletes the class and everything in it for good. */
  async remove(id: number, teacherId: number): Promise<void> {
    await this.findOne(id, teacherId);
    await this.repository.delete(id);
  }

  private checked(document: Record<string, unknown>): ClassroomDocument {
    if (JSON.stringify(document).length > MAX_DOCUMENT_CHARS) {
      throw new PayloadTooLargeException(
        'This class has too much data to save.',
      );
    }
    return parseClassroomDocument(document);
  }
}
