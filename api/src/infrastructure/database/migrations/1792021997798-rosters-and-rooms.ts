import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Classes (rosters), students, pair rules, rooms and seating charts, plus the
 * session version that lets a teacher end every session at once.
 */
export class RostersAndRooms1792021997798 implements MigrationInterface {
  name = 'RostersAndRooms1792021997798';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "session_version" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`
      CREATE TABLE "rosters" (
        "id" SERIAL PRIMARY KEY,
        "teacher_id" integer NOT NULL,
        "name" character varying(60) NOT NULL,
        "color_names" text[] NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_rosters_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_rosters_teacher" ON "rosters" ("teacher_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "students" (
        "id" SERIAL PRIMARY KEY,
        "roster_id" integer NOT NULL,
        "first_name" character varying(20) NOT NULL,
        "level" smallint NOT NULL,
        "color" smallint,
        "accommodations" text[] NOT NULL DEFAULT '{}',
        "traits" text[] NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_students_level" CHECK ("level" BETWEEN 1 AND 3),
        CONSTRAINT "CHK_students_color" CHECK ("color" BETWEEN 0 AND 3),
        CONSTRAINT "FK_students_roster" FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_students_roster" ON "students" ("roster_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "pair_rules" (
        "id" SERIAL PRIMARY KEY,
        "roster_id" integer NOT NULL,
        "student_a_id" integer NOT NULL,
        "student_b_id" integer NOT NULL,
        "kind" character varying(10) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_pair_rules_kind" CHECK ("kind" IN ('APART', 'TOGETHER')),
        CONSTRAINT "CHK_pair_rules_two_students" CHECK ("student_a_id" <> "student_b_id"),
        CONSTRAINT "FK_pair_rules_roster" FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pair_rules_student_a" FOREIGN KEY ("student_a_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pair_rules_student_b" FOREIGN KEY ("student_b_id") REFERENCES "students"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_pair_rules_roster" ON "pair_rules" ("roster_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" SERIAL PRIMARY KEY,
        "roster_id" integer NOT NULL,
        "name" character varying(60) NOT NULL,
        "base_layout_id" character varying(80) NOT NULL,
        "layout" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_rooms_roster" FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_rooms_roster" ON "rooms" ("roster_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "arrangements" (
        "id" SERIAL PRIMARY KEY,
        "room_id" integer NOT NULL,
        "assignment" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_arrangements_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_arrangements_room_created" ON "arrangements" ("room_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "arrangements"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "pair_rules"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "rosters"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "session_version"`,
    );
  }
}
