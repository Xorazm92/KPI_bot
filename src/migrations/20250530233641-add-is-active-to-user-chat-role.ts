import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsActiveToUserChatRole20250530233641 implements MigrationInterface {
    name = 'AddIsActiveToUserChatRole20250530233641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_chat_roles" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_chat_roles" DROP COLUMN "isActive"`);
    }
}
