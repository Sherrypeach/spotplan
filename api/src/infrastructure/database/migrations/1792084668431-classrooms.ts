import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the per-table class model with one document per class (the tables
 * held only test data), and adds a try count to password-reset codes.
 */
export class Classrooms1792084668431 implements MigrationInterface {
  name = 'Classrooms1792084668431';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "arrangements"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "pair_rules"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "rosters"`);
    await queryRunner.query(`
      CREATE TABLE "classrooms" (
        "id" SERIAL PRIMARY KEY,
        "teacher_id" integer NOT NULL,
        "name" character varying(60) NOT NULL,
        "document" jsonb NOT NULL,
        "revision" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_classrooms_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_classrooms_teacher" ON "classrooms" ("teacher_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otp_attempts" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_attempts"`);
    await queryRunner.query(`DROP TABLE "classrooms"`);
    // The old tables come back empty; recreate them by re-running the
    // previous migration's up() if they're ever needed again.
  }
}
