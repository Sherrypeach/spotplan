import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GenericRepository } from '@core/abstracts/generic.repository';
import { TypeOrmRepository } from '@core/abstracts/typeorm.repository';
import { Classroom } from '@modules/classroom/entities/classroom.entity';
import { ClassroomDocument } from '@modules/classroom/interfaces/classroom-document.interface';

type ClassroomSummaryRow = {
  id: number;
  name: string;
  studentCount: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ClassroomRepository
  extends TypeOrmRepository<Classroom>
  implements GenericRepository<Classroom>
{
  constructor(
    @InjectRepository(Classroom) protected repository: Repository<Classroom>,
  ) {
    super(repository);
  }

  /** The teacher's classes with a student count, without the documents. */
  async findSummariesByTeacher(teacherId: number): Promise<Classroom[]> {
    const rows = await this.repository
      .createQueryBuilder('classroom')
      .select('classroom.id', 'id')
      .addSelect('classroom.name', 'name')
      .addSelect(
        "jsonb_array_length(classroom.document -> 'students')",
        'studentCount',
      )
      .addSelect('classroom.created_at', 'createdAt')
      .addSelect('classroom.updated_at', 'updatedAt')
      .where('classroom.teacher_id = :teacherId', { teacherId })
      .orderBy('classroom.created_at', 'ASC')
      .getRawMany<ClassroomSummaryRow>();
    return rows.map((row) =>
      Object.assign(new Classroom(), {
        ...row,
        studentCount: Number(row.studentCount),
      }),
    );
  }

  findOwned(id: number, teacherId: number): Promise<Classroom | null> {
    return this.repository.findOne({ where: { id, teacherId } });
  }

  /**
   * Saves only if nobody saved since `revision` was read. Answers with the
   * row as this save left it (from the same statement, so another save can't
   * slip in between), or null when the revision no longer matches.
   */
  async saveIfRevision(
    id: number,
    teacherId: number,
    revision: number,
    changes: { name?: string; document: ClassroomDocument },
  ): Promise<{ name: string; revision: number } | null> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Classroom)
      .set({
        ...(changes.name === undefined ? {} : { name: changes.name }),
        document: changes.document,
        revision: () => 'revision + 1',
      })
      .where('id = :id AND teacher_id = :teacherId AND revision = :revision', {
        id,
        teacherId,
        revision,
      })
      .returning(['name', 'revision'])
      .execute();
    const row = (result.raw as { name: string; revision: number }[])[0];
    return result.affected === 1 && row ? row : null;
  }

  /**
   * True when this exact document is already saved as the revision right
   * after `revision`: a save that went through but whose answer was lost.
   */
  isAlreadySaved(
    id: number,
    teacherId: number,
    revision: number,
    document: ClassroomDocument,
  ): Promise<boolean> {
    return this.repository
      .createQueryBuilder('classroom')
      .where(
        'classroom.id = :id AND classroom.teacher_id = :teacherId AND classroom.revision = :next AND classroom.document = CAST(:document AS jsonb)',
        {
          id,
          teacherId,
          next: revision + 1,
          document: JSON.stringify(document),
        },
      )
      .getExists();
  }

  /**
   * Adds a class unless the teacher already has `max`. The teacher's row is
   * locked while counting, so two classes added at once can't both slip in.
   */
  createWithinLimit(
    data: Partial<Classroom> & { teacherId: number },
    max: number,
  ): Promise<Classroom | null> {
    return this.repository.manager.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        data.teacherId,
      ]);
      const count = await manager.count(Classroom, {
        where: { teacherId: data.teacherId },
      });
      if (count >= max) return null;
      return manager.save(manager.create(Classroom, data));
    });
  }
}
