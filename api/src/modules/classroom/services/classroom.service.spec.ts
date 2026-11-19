import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ClassroomRepository } from '@modules/classroom/classroom.repository';
import { ClassroomService } from '@modules/classroom/services/classroom.service';
import { newClassroomDocument } from '@modules/classroom/utils/new-classroom-document';

describe('ClassroomService', () => {
  let service: ClassroomService;
  const repository = {
    findSummariesByTeacher: jest.fn(),
    findOwned: jest.fn(),
    saveIfRevision: jest.fn(),
    isAlreadySaved: jest.fn(),
    createWithinLimit: jest.fn((data: object): Promise<object | null> =>
      Promise.resolve({ id: 1, ...data }),
    ),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClassroomService,
        { provide: ClassroomRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ClassroomService);
  });

  it('creates an empty class for the signed-in teacher', async () => {
    await service.create(7, { name: 'Room 12' });
    expect(repository.createWithinLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: 7,
        name: 'Room 12',
        document: newClassroomDocument(),
        revision: 1,
      }),
      20,
    );
  });

  it('checks a restored backup like any save', async () => {
    await expect(
      service.create(7, { name: 'Restored', document: { version: 1 } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('caps how many classes a teacher can have', async () => {
    repository.createWithinLimit.mockResolvedValueOnce(null);
    await expect(service.create(7, { name: 'One more' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses a save based on an older revision', async () => {
    repository.findOwned.mockResolvedValue({
      id: 1,
      name: 'Room 12',
      revision: 3,
    });
    repository.saveIfRevision.mockResolvedValue(null);
    repository.isAlreadySaved.mockResolvedValue(false);
    const save = service.save(1, 7, {
      document: newClassroomDocument() as never,
      revision: 2,
    });
    await expect(save).rejects.toThrow(ConflictException);
  });

  it('answers with the revision its own update produced', async () => {
    repository.saveIfRevision.mockResolvedValue({
      name: 'Room 12',
      revision: 4,
    });
    const saved = await service.save(1, 7, {
      document: newClassroomDocument() as never,
      revision: 3,
    });
    expect(saved).toMatchObject({ id: 1, name: 'Room 12', revision: 4 });
    expect(repository.findOwned).not.toHaveBeenCalled();
  });

  it('accepts the same save sent again after its answer was lost', async () => {
    repository.saveIfRevision.mockResolvedValue(null);
    repository.findOwned.mockResolvedValue({
      id: 1,
      name: 'Room 12',
      revision: 4,
    });
    repository.isAlreadySaved.mockResolvedValue(true);
    const saved = await service.save(1, 7, {
      document: newClassroomDocument() as never,
      revision: 3,
    });
    expect(saved).toMatchObject({ revision: 4 });
    expect(repository.isAlreadySaved).toHaveBeenCalledWith(
      1,
      7,
      3,
      newClassroomDocument(),
    );
  });

  it("answers not found when saving another teacher's class", async () => {
    repository.saveIfRevision.mockResolvedValue(null);
    repository.findOwned.mockResolvedValue(null);
    await expect(
      service.save(1, 8, {
        document: newClassroomDocument() as never,
        revision: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses a class that is too big to save', async () => {
    repository.findOwned.mockResolvedValue({
      id: 1,
      name: 'Room 12',
      revision: 1,
    });
    const huge = { ...newClassroomDocument(), padding: 'x'.repeat(400_001) };
    await expect(
      service.save(1, 7, { document: huge, revision: 1 }),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it("answers not found for another teacher's class", async () => {
    repository.findOwned.mockResolvedValue(null);
    await expect(service.findOne(1, 8)).rejects.toThrow(NotFoundException);
    await expect(service.remove(1, 8)).rejects.toThrow(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
