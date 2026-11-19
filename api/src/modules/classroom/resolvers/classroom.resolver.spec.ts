import { ClassroomResolver } from '@modules/classroom/resolvers/classroom.resolver';
import { ClassroomWriteLimiterService } from '@modules/classroom/services/classroom-write-limiter.service';
import { ClassroomService } from '@modules/classroom/services/classroom.service';
import { User } from '@modules/user/entities/user.entity';

describe('ClassroomResolver', () => {
  const teacher = { id: 7 } as User;
  let service: jest.Mocked<
    Pick<
      ClassroomService,
      'findMine' | 'findOne' | 'create' | 'save' | 'remove'
    >
  >;
  let limiter: { assertAllowed: jest.Mock };
  let resolver: ClassroomResolver;

  beforeEach(() => {
    service = {
      findMine: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 3 }),
      create: jest.fn().mockResolvedValue({ id: 4 }),
      save: jest.fn().mockResolvedValue({ id: 3, revision: 2 }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    limiter = { assertAllowed: jest.fn() };
    resolver = new ClassroomResolver(
      service as unknown as ClassroomService,
      limiter as unknown as ClassroomWriteLimiterService,
    );
  });

  it('only ever asks for the signed-in teacher’s classes', async () => {
    await resolver.findMine(teacher);
    await resolver.findOne(teacher, 3);
    expect(service.findMine).toHaveBeenCalledWith(7);
    expect(service.findOne).toHaveBeenCalledWith(3, 7);
  });

  it('checks the write limit before creating or saving', async () => {
    await resolver.create(teacher, { name: 'Room 12' });
    await resolver.save(teacher, 3, { revision: 1, document: {} });
    expect(limiter.assertAllowed).toHaveBeenNthCalledWith(1, 'create', 7);
    expect(limiter.assertAllowed).toHaveBeenNthCalledWith(2, 'save', 7);
    expect(service.create).toHaveBeenCalledWith(7, { name: 'Room 12' });
    expect(service.save).toHaveBeenCalledWith(3, 7, {
      revision: 1,
      document: {},
    });
  });

  it('saves nothing once the write limit refuses', () => {
    limiter.assertAllowed.mockImplementation(() => {
      throw new Error('too many');
    });
    expect(() =>
      resolver.save(teacher, 3, { revision: 1, document: {} }),
    ).toThrow('too many');
    expect(service.save).not.toHaveBeenCalled();
  });

  it('answers ok after deleting a class, and passes on a refusal', async () => {
    await expect(resolver.remove(teacher, 3)).resolves.toEqual({ ok: true });
    expect(service.remove).toHaveBeenCalledWith(3, 7);
    service.remove.mockRejectedValueOnce(new Error('not found'));
    await expect(resolver.remove(teacher, 9)).rejects.toThrow('not found');
  });
});
