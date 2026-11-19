import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel } from '@core/models/base.model';
import { ClassroomDocument } from '@modules/classroom/interfaces/classroom-document.interface';
import { User } from '@modules/user/entities/user.entity';
import { MAX_CLASS_NAME } from '@modules/classroom/utils/classroom-limits';

/** One of a teacher's classes, with everything in it kept as one document. */
@Entity('classrooms')
export class Classroom extends BaseModel {
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'teacher_id',
    foreignKeyConstraintName: 'FK_classrooms_teacher',
  })
  teacher: User;

  // Made by the classrooms migration; declared here so TypeORM doesn't drop it.
  @Index('IDX_classrooms_teacher')
  @Column({ name: 'teacher_id' })
  teacherId: number;

  @Column({ length: MAX_CLASS_NAME })
  name: string;

  @Column({ type: 'jsonb' })
  document: ClassroomDocument;

  /** Goes up on every save; a save based on an older revision is refused. */
  @Column({ default: 1 })
  revision: number;

  /** Filled in by list queries from the document, without loading it. */
  studentCount?: number;
}
