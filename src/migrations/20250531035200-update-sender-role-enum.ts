import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSenderRoleEnum20250531035200 implements MigrationInterface {
    name = 'UpdateSenderRoleEnum20250531035200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Kerakli rollarni qo‘shish
        await queryRunner.query(`ALTER TYPE "message_logs_senderroleatmoment_enum" ADD VALUE IF NOT EXISTS 'CLIENT';`);
        await queryRunner.query(`ALTER TYPE "message_logs_senderroleatmoment_enum" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';`);
        await queryRunner.query(`ALTER TYPE "message_logs_senderroleatmoment_enum" ADD VALUE IF NOT EXISTS 'SUPERVISOR';`);
        await queryRunner.query(`ALTER TYPE "message_logs_senderroleatmoment_enum" ADD VALUE IF NOT EXISTS 'BANK_CLIENT';`);
        // Yana boshqa rollar kerak bo‘lsa, shu yerga qo‘shing
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ENUMdan qiymatni olib tashlash uchun maxsus jarayon kerak, shuning uchun bu yerda hech narsa qilinmaydi.
    }
}
