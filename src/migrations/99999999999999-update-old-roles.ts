import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOldRoles1699999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop defaults
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" DROP DEFAULT;`);

    // 2. Create new enums
    await queryRunner.query(`CREATE TYPE user_chat_roles_role_enum_new AS ENUM ('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT');`);
    await queryRunner.query(`CREATE TYPE message_logs_senderroleatmoment_enum_new AS ENUM ('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT');`);
    await queryRunner.query(`CREATE TYPE report_types_responsibleroles_enum_new AS ENUM ('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT');`);

    // 3. Convert columns to new enums
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role TYPE user_chat_roles_role_enum_new USING role::text::user_chat_roles_role_enum_new;`);
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" TYPE message_logs_senderroleatmoment_enum_new USING "senderRoleAtMoment"::text::message_logs_senderroleatmoment_enum_new;`);
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" TYPE report_types_responsibleroles_enum_new[] USING "responsibleRoles"::text::report_types_responsibleroles_enum_new[];`);

    // 4. Drop old enums and rename new enums
    await queryRunner.query(`DROP TYPE user_chat_roles_role_enum;`);
    await queryRunner.query(`ALTER TYPE user_chat_roles_role_enum_new RENAME TO user_chat_roles_role_enum;`);
    await queryRunner.query(`DROP TYPE message_logs_senderroleatmoment_enum;`);
    await queryRunner.query(`ALTER TYPE message_logs_senderroleatmoment_enum_new RENAME TO message_logs_senderroleatmoment_enum;`);
    await queryRunner.query(`DROP TYPE report_types_responsibleroles_enum;`);
    await queryRunner.query(`ALTER TYPE report_types_responsibleroles_enum_new RENAME TO report_types_responsibleroles_enum;`);

    // 5. Update all old values
    await queryRunner.query(`UPDATE user_chat_roles SET role = 'BANK_CLIENT' WHERE role IN ('BANK_KLIENT', 'BAKK_KLIENT', 'CLIENT');`);
    await queryRunner.query(`UPDATE message_logs SET "senderRoleAtMoment" = 'BANK_CLIENT' WHERE "senderRoleAtMoment" IN ('BANK_KLIENT', 'BAKK_KLIENT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'BANK_KLIENT', 'BANK_CLIENT') WHERE 'BANK_KLIENT' = ANY("responsibleRoles");`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'BAKK_KLIENT', 'BANK_CLIENT') WHERE 'BAKK_KLIENT' = ANY("responsibleRoles");`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'CLIENT', 'BANK_CLIENT') WHERE 'CLIENT' = ANY("responsibleRoles");`);

    // 6. Restore defaults
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role SET DEFAULT 'BANK_CLIENT';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This is a one-way migration
  }
}
