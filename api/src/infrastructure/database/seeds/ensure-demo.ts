import 'dotenv/config';

import * as bcrypt from 'bcrypt';

import { RoleEnum } from '@core/enums/role.enum';
import { AppDataSource } from '@infrastructure/database/data-source';
import { Role } from '@modules/role/entities/role.entity';
import { User } from '@modules/user/entities/user.entity';

/**
 * Makes sure the public demo account exists with the password from
 * DEMO_PASSWORD (it is reset on every start). Does nothing without
 * DEMO_EMAIL and DEMO_PASSWORD.
 */
async function ensureDemo() {
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return;

  await AppDataSource.initialize();
  const users = AppDataSource.getRepository(User);
  const role = await AppDataSource.getRepository(Role).findOne({
    where: { name: RoleEnum.USER },
  });
  if (!role) throw new Error('User role missing; run the seeds first.');
  const hash = await bcrypt.hash(
    password,
    parseInt(process.env.SALT_ROUNDS ?? '10'),
  );
  const existing = await users.findOne({ where: { email }, withDeleted: true });
  if (existing) {
    existing.password = hash;
    await users.save(existing);
  } else {
    await users.save(
      users.create({
        email,
        password: hash,
        firstName: 'Demo',
        lastName: 'Manager',
        role,
      }),
    );
  }
  console.log(`Demo account ready: ${email}`);
  await AppDataSource.destroy();
}

ensureDemo().catch((error: Error) => {
  console.error(`Couldn't prepare the demo account: ${error.message}`);
  process.exit(1);
});
