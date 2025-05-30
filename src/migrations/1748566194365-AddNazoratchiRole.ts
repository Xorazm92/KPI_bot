import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNazoratchiRole1748566194365 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. First, update any BUXGALTER roles to AGENT
    await queryRunner.query(`
            UPDATE "user_chat_roles" 
            SET "role" = 'AGENT' 
            WHERE "role" = 'BUXGALTER';
        `);

    // 2. Drop the default value constraint if it exists
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            ALTER COLUMN "role" DROP DEFAULT;
        `);

    // 3. Rename the existing enum type
    await queryRunner.query(`
            ALTER TYPE "user_chat_roles_role_enum" 
            RENAME TO "user_chat_roles_role_enum_old";
        `);

    // 4. Create a new enum type with the additional role
    await queryRunner.query(`
            CREATE TYPE "user_chat_roles_role_enum" AS ENUM(
                'ADMIN',
                'SUPERVISOR',
                'NAZORATCHI',
                'AGENT',
                'BANK_CLIENT',
                'BOT'
            );
        `);

    // 5. Create a temporary column to hold the new enum values
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            ADD COLUMN "role_new" "user_chat_roles_role_enum";
        `);

    // 6. Copy and convert the old role values to the new column
    await queryRunner.query(`
            UPDATE "user_chat_roles" 
            SET "role_new" = "role"::text::"user_chat_roles_role_enum";
        `);

    // 7. Drop the old column and rename the new one
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            DROP COLUMN "role";
            
            ALTER TABLE "user_chat_roles" 
            RENAME COLUMN "role_new" TO "role";
            
            ALTER TABLE "user_chat_roles" 
            ALTER COLUMN "role" SET NOT NULL;
        `);

    // 8. Set the default value back to 'BANK_CLIENT'
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            ALTER COLUMN "role" SET DEFAULT 'BANK_CLIENT';
        `);

    // 9. Drop the old enum type
    await queryRunner.query(`
            DROP TYPE "user_chat_roles_role_enum_old";
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. First, update any rows that use the NAZORATCHI role to SUPERVISOR
    await queryRunner.query(`
            UPDATE "user_chat_roles" 
            SET "role" = 'SUPERVISOR' 
            WHERE "role" = 'NAZORATCHI';
        `);

    // 2. Drop the default value constraint if it exists
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            ALTER COLUMN "role" DROP DEFAULT;
        `);

    // 3. Rename the current enum type
    await queryRunner.query(`
            ALTER TYPE "user_chat_roles_role_enum" 
            RENAME TO "user_chat_roles_role_enum_old";
        `);

    // 4. Recreate the original enum type without NAZORATCHI
    await queryRunner.query(`
            CREATE TYPE "user_chat_roles_role_enum" AS ENUM(
                'ADMIN',
                'SUPERVISOR',
                'AGENT',
                'BANK_CLIENT',
                'BOT',
                'BUXGALTER'
            );
        `);

    // 5. Create a temporary column to hold the old enum values
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            ADD COLUMN "role_old" "user_chat_roles_role_enum";
        `);

    // 6. Copy and convert the role values to the old column
    await queryRunner.query(`
            UPDATE "user_chat_roles" 
            SET "role_old" = "role"::text::"user_chat_roles_role_enum";
        `);

    // 7. Drop the current column and rename the old one back
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            DROP COLUMN "role";
            
            ALTER TABLE "user_chat_roles" 
            RENAME COLUMN "role_old" TO "role";
            
            ALTER TABLE "user_chat_roles" 
            ALTER COLUMN "role" SET NOT NULL;
        `);

    // 8. Set the default value back to 'BANK_CLIENT'
    await queryRunner.query(`
            ALTER TABLE "user_chat_roles" 
            ALTER COLUMN "role" SET DEFAULT 'BANK_CLIENT';
        `);

    // 9. Drop the temporary enum type
    await queryRunner.query(`
            DROP TYPE "user_chat_roles_role_enum_old";
        `);
  }
}
