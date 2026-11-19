/**
 * Permissions follow `<ENTITY>_<ACTION>`.
 * Every value added here must also be added to the permission seeder so it
 * exists in the database and can be assigned to roles.
 */
export enum PermissionEnum {
  USER_CREATE = 'USER_CREATE',
  USER_READ = 'USER_READ',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  ROLE_READ = 'ROLE_READ',
  CLASSROOM_READ = 'CLASSROOM_READ',
  CLASSROOM_WRITE = 'CLASSROOM_WRITE',
}
