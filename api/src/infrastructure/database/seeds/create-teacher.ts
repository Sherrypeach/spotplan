import 'dotenv/config';
import { randomBytes } from 'crypto';

import * as bcrypt from 'bcrypt';

import { RoleEnum } from '@core/enums/role.enum';
import { AppDataSource } from '@infrastructure/database/data-source';
import { Role } from '@modules/role/entities/role.entity';
import { User } from '@modules/user/entities/user.entity';

/**
 * Creates a teacher account; there's no public sign-up. Prints a random
 * password to hand to the teacher privately.
 * Run: `npm run teacher:create -- teacher@school.org "First" "Last"`
 */
async function createTeacher() {
  const [email, firstName, lastName] = process.argv.slice(2);
  if (!email || !email.includes('@')) {
    console.error(
      'Usage: npm run teacher:create -- <email> [first name] [last name]',
    );
    process.exit(1);
  }

  await AppDataSource.initialize();
  const users = AppDataSource.getRepository(User);
  const normalizedEmail = email.trim().toLowerCase();
  if (
    await users.findOne({
      where: { email: normalizedEmail },
      withDeleted: true,
    })
  ) {
    console.error('A user with that email already exists.');
    process.exit(1);
  }
  const role = await AppDataSource.getRepository(Role).findOne({
    where: { name: RoleEnum.USER },
  });
  if (!role) throw new Error('Teacher role missing; run `npm run seed` first.');

  const password = randomBytes(9).toString('base64url');
  await users.save(
    users.create({
      email: normalizedEmail,
      password: await bcrypt.hash(
        password,
        parseInt(process.env.SALT_ROUNDS ?? '10'),
      ),
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      role,
    }),
  );
  console.log(`Teacher created: ${normalizedEmail}`);
  console.log(`Password: ${password}`);
  await AppDataSource.destroy();
}

createTeacher().catch((error: Error) => {
  console.error(`Couldn't create the teacher: ${error.message}`);
  process.exit(1);
});
