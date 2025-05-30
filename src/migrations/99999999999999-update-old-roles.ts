import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOldRoles1699999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Drop default to allow type changes
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role DROP DEFAULT;`);

    // 1. Cast role to text to allow value updates regardless of enum state
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role TYPE text;`);

    // 2. Update all old values to new ones
    await queryRunner.query(`UPDATE user_chat_roles SET role = 'ACCOUNTANT' WHERE role IN ('AGENT', 'BUXGALTER');`);
    await queryRunner.query(`UPDATE user_chat_roles SET role = 'BANK_CLIENT' WHERE role IN ('BANK_KLIENT', 'CLIENT');`);
    await queryRunner.query(`UPDATE user_chat_roles SET role = 'SUPERVISOR' WHERE role = 'NAZORATCHI';`);

    // 3. Drop old enum types if they exist
    await queryRunner.query(`DO $$ BEGIN BEGIN EXECUTE 'DROP TYPE IF EXISTS user_chat_roles_role_enum CASCADE'; EXCEPTION WHEN undefined_object THEN NULL; END; END $$;`);
    await queryRunner.query(`DO $$ BEGIN BEGIN EXECUTE 'DROP TYPE IF EXISTS user_chat_roles_role_enum_new CASCADE'; EXCEPTION WHEN undefined_object THEN NULL; END; END $$;`);

    // 4. Create new enum type with only allowed values
    await queryRunner.query(`CREATE TYPE user_chat_roles_role_enum AS ENUM ('ADMIN', 'SUPERVISOR', 'ACCOUNTANT', 'BANK_CLIENT', 'BOT');`);

    // 5. Cast column back to enum
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role TYPE user_chat_roles_role_enum USING role::user_chat_roles_role_enum;`);

    // 6. Restore default
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role SET DEFAULT 'BANK_CLIENT';`);

    // 0. Drop default to allow type changes
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" DROP DEFAULT;`);

    // 1. Cast senderRoleAtMoment to text to allow value updates
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" TYPE text;`);

    // 2. Update all old values to new ones
    await queryRunner.query(`UPDATE message_logs SET "senderRoleAtMoment" = 'ACCOUNTANT' WHERE "senderRoleAtMoment" IN ('AGENT', 'BUXGALTER', 'CLIENT');`);
    await queryRunner.query(`UPDATE message_logs SET "senderRoleAtMoment" = 'BANK_CLIENT' WHERE "senderRoleAtMoment" IN ('BANK_KLIENT');`);
    await queryRunner.query(`UPDATE message_logs SET "senderRoleAtMoment" = 'SUPERVISOR' WHERE "senderRoleAtMoment" IN ('NAZORATCHI');`);

    // 3. Drop old enum types if they exist
    await queryRunner.query(`DO $$ BEGIN BEGIN EXECUTE 'DROP TYPE IF EXISTS message_logs_senderroleatmoment_enum CASCADE'; EXCEPTION WHEN undefined_object THEN NULL; END; END $$;`);
    await queryRunner.query(`DO $$ BEGIN BEGIN EXECUTE 'DROP TYPE IF EXISTS message_logs_senderroleatmoment_enum_new CASCADE'; EXCEPTION WHEN undefined_object THEN NULL; END; END $$;`);

    // 4. Create new enum type with only allowed values
    await queryRunner.query(`CREATE TYPE message_logs_senderroleatmoment_enum AS ENUM ('ADMIN', 'SUPERVISOR', 'ACCOUNTANT', 'BANK_CLIENT', 'BOT');`);

    // 5. Cast column back to enum
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" TYPE message_logs_senderroleatmoment_enum USING "senderRoleAtMoment"::message_logs_senderroleatmoment_enum;`);

    // 6. Restore default
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" SET DEFAULT 'BANK_CLIENT';`);


    await queryRunner.query(`UPDATE user_chat_roles SET role = 'ACCOUNTANT' WHERE role IN ('AGENT', 'BUXGALTER', 'CLIENT');`);
    await queryRunner.query(`UPDATE user_chat_roles SET role = 'BANK_CLIENT' WHERE role IN ('BANK_KLIENT');`);
    await queryRunner.query(`UPDATE user_chat_roles SET role = 'SUPERVISOR' WHERE role IN ('NAZORATCHI');`);

    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'AGENT', 'ACCOUNTANT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'BUXGALTER', 'ACCOUNTANT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'CLIENT', 'ACCOUNTANT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'BANK_KLIENT', 'BANK_CLIENT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'NAZORATCHI', 'SUPERVISOR');`);

    // 1. Drop defaults
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE message_logs ALTER COLUMN "senderRoleAtMoment" DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" DROP DEFAULT;`);

    // 0. Drop default to allow type changes
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" DROP DEFAULT;`);

    // 1. Cast responsibleRoles to text[] to allow value updates
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" TYPE text[] USING array_agg("responsibleRoles") OVER ();`);

    // 2. Update all old values to new ones
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'BUXGALTER', 'ACCOUNTANT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'CLIENT', 'BANK_CLIENT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'BANK_KLIENT', 'BANK_CLIENT');`);
    await queryRunner.query(`UPDATE report_types SET "responsibleRoles" = array_replace("responsibleRoles", 'NAZORATCHI', 'SUPERVISOR');`);

    // 3. Drop old enum types if they exist
    await queryRunner.query(`DO $$ BEGIN BEGIN EXECUTE 'DROP TYPE IF EXISTS report_types_responsibleroles_enum CASCADE'; EXCEPTION WHEN undefined_object THEN NULL; END; END $$;`);
    await queryRunner.query(`DO $$ BEGIN BEGIN EXECUTE 'DROP TYPE IF EXISTS report_types_responsibleroles_enum_new CASCADE'; EXCEPTION WHEN undefined_object THEN NULL; END; END $$;`);

    // 4. Create new enum type with only allowed values
    await queryRunner.query(`CREATE TYPE report_types_responsibleroles_enum AS ENUM ('ADMIN', 'SUPERVISOR', 'ACCOUNTANT', 'BANK_CLIENT', 'BOT');`);

    // 5. Cast column back to enum[]
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" TYPE report_types_responsibleroles_enum[] USING "responsibleRoles"::report_types_responsibleroles_enum[];`);

    // 6. Restore default
    await queryRunner.query(`ALTER TABLE report_types ALTER COLUMN "responsibleRoles" SET DEFAULT ARRAY['BANK_CLIENT']::report_types_responsibleroles_enum[];`);


    // 4. Drop old enums and rename new enums
    await queryRunner.query(`DROP TYPE user_chat_roles_role_enum;`);
    await queryRunner.query(`ALTER TYPE user_chat_roles_role_enum_new RENAME TO user_chat_roles_role_enum;`);
    await queryRunner.query(`DROP TYPE message_logs_senderroleatmoment_enum;`);
    await queryRunner.query(`ALTER TYPE message_logs_senderroleatmoment_enum_new RENAME TO message_logs_senderroleatmoment_enum;`);
    await queryRunner.query(`DROP TYPE report_types_responsibleroles_enum;`);
    await queryRunner.query(`ALTER TYPE report_types_responsibleroles_enum_new RENAME TO report_types_responsibleroles_enum;`);


    // 6. Restore defaults
    await queryRunner.query(`ALTER TABLE user_chat_roles ALTER COLUMN role SET DEFAULT 'BANK_CLIENT';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This is a one-way migration
  }
}
