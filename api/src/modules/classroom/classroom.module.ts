import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClassroomRepository } from '@modules/classroom/classroom.repository';
import { Classroom } from '@modules/classroom/entities/classroom.entity';
import { ClassroomResolver } from '@modules/classroom/resolvers/classroom.resolver';
import { ClassroomWriteLimiterService } from '@modules/classroom/services/classroom-write-limiter.service';
import { ClassroomService } from '@modules/classroom/services/classroom.service';

/** A teacher's classes: roster, room, seating and charts, one document each. */
@Module({
  imports: [TypeOrmModule.forFeature([Classroom])],
  providers: [
    ClassroomResolver,
    ClassroomService,
    ClassroomRepository,
    ClassroomWriteLimiterService,
  ],
  exports: [ClassroomService],
})
export class ClassroomModule {}
