import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsActiveToUserEntity20250530233641 implements MigrationInterface {
    name = 'AddIsActiveToUserEntity20250530233641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
    }
}
