import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sessions signed out on one device, refused until their tokens expire. */
export class EndedSessions1792096209357 implements MigrationInterface {
  name = 'EndedSessions1792096209357';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ended_sessions" (
        "session_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_ended_sessions" PRIMARY KEY ("session_id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ended_sessions_expires_at" ON "ended_sessions" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ended_sessions"`);
  }
}
