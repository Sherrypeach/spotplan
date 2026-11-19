import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PermissionEnum } from '@core/enums/permission.enum';
import { RoleEnum } from '@core/enums/role.enum';
import { AppDataSource } from '@infrastructure/database/data-source';
import { Permission } from '@modules/role/entities/permission.entity';
import { Role } from '@modules/role/entities/role.entity';
import { User } from '@modules/user/entities/user.entity';

/**
 * Reference data lives in seeders, not migrations. Idempotent —
 * safe to re-run after adding a PermissionEnum value or changing role grants.
 * Run: `npm run seed`
 */
const ROLE_GRANTS: Record<RoleEnum, PermissionEnum[]> = {
  [RoleEnum.ADMIN]: Object.values(PermissionEnum),
  // Teachers.
  [RoleEnum.USER]: [
    PermissionEnum.CLASSROOM_READ,
    PermissionEnum.CLASSROOM_WRITE,
  ],
};

async function seed() {
  await AppDataSource.initialize();
  const permissionRepo = AppDataSource.getRepository(Permission);
  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);

  // 1. Permissions — one row per enum value.
  const permissions = new Map<string, Permission>();
  for (const name of Object.values(PermissionEnum)) {
    let permission = await permissionRepo.findOne({ where: { name } });
    if (!permission)
      permission = await permissionRepo.save(permissionRepo.create({ name }));
    permissions.set(name, permission);
  }

  // 2. Roles + grants (grants are replaced to match ROLE_GRANTS exactly).
  const roles = new Map<string, Role>();
  for (const [name, grants] of Object.entries(ROLE_GRANTS)) {
    let role = await roleRepo.findOne({
      where: { name },
      relations: ['permissions'],
    });
    if (!role) role = roleRepo.create({ name });
    role.permissions = grants.map((g) => {
      const permission = permissions.get(g);
      if (!permission) throw new Error(`permission ${g} missing`);
      return permission;
    });
    role = await roleRepo.save(role);
    roles.set(name, role);
  }

  // 3. Admin user (env-driven; skipped when SEED_ADMIN_EMAIL is unset).
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await userRepo.findOne({ where: { email: adminEmail } });
    if (!existing) {
      const adminRole = roles.get(RoleEnum.ADMIN);
      if (!adminRole) throw new Error('admin role missing');
      await userRepo.save(
        userRepo.create({
          email: adminEmail,
          password: await bcrypt.hash(
            adminPassword,
            parseInt(process.env.SALT_ROUNDS ?? '10'),
          ),
          role: adminRole,
        }),
      );
      console.log(`[seed] admin user created: ${adminEmail}`);
    }
  }

  console.log('[seed] done');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
