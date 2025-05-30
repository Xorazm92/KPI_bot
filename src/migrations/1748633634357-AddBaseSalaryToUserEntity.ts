import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBaseSalaryToUserEntity1748633634357 implements MigrationInterface {
    name = 'AddBaseSalaryToUserEntity1748633634357'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "message_responses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "originalMessageId" uuid NOT NULL, "responseMessageId" character varying NOT NULL, "responderId" character varying NOT NULL, "responseTime" TIMESTAMP NOT NULL, "responseTimeSeconds" integer, "responseText" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f50ce8cd93054476eae3e9e1aef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."kpi_scores_role_enum" AS ENUM('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT')`);
        await queryRunner.query(`CREATE TABLE "kpi_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."kpi_scores_role_enum" NOT NULL, "periodStart" date NOT NULL, "periodEnd" date NOT NULL, "responseTimeScore" numeric(5,2) NOT NULL DEFAULT '0', "totalQuestions" integer NOT NULL DEFAULT '0', "onTimeResponses" integer NOT NULL DEFAULT '0', "lateResponses" integer NOT NULL DEFAULT '0', "reportSubmissionScore" numeric(5,2) NOT NULL DEFAULT '0', "totalReports" integer NOT NULL DEFAULT '0', "onTimeReports" integer NOT NULL DEFAULT '0', "lateReports" integer NOT NULL DEFAULT '0', "attendanceScore" numeric(5,2) NOT NULL DEFAULT '0', "totalWorkDays" integer NOT NULL DEFAULT '0', "onTimeArrivals" integer NOT NULL DEFAULT '0', "lateArrivals" integer NOT NULL DEFAULT '0', "responseQualityScore" numeric(5,2) NOT NULL DEFAULT '0', "finalScore" numeric(5,2) NOT NULL DEFAULT '0', "bonusAmount" numeric(10,2) NOT NULL DEFAULT '0', "penaltyAmount" numeric(10,2) NOT NULL DEFAULT '0', "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, CONSTRAINT "PK_a56b4e369d51e69f9f1f54d082b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2785d3cec73fa17e9804814011" ON "kpi_scores" ("userId", "periodStart", "periodEnd") `);
        await queryRunner.query(`CREATE TYPE "public"."kpi_reports_status_enum" AS ENUM('draft', 'published', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."kpi_reports_userrole_enum" AS ENUM('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT')`);
        await queryRunner.query(`CREATE TABLE "kpi_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "startDate" date NOT NULL, "endDate" date NOT NULL, "status" "public"."kpi_reports_status_enum" NOT NULL DEFAULT 'draft', "metrics" jsonb NOT NULL DEFAULT '{}', "totalScore" numeric(5,2) NOT NULL DEFAULT '0', "bonusAmount" numeric(10,2), "penaltyAmount" numeric(10,2), "notes" text, "userId" uuid, "userRole" "public"."kpi_reports_userrole_enum", "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP, "archivedAt" TIMESTAMP, CONSTRAINT "PK_13bdee28fa88d817961ba077821" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8a6bb61c15b68b3aa2f07e1b1a" ON "kpi_reports" ("userId", "startDate", "endDate") `);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('info', 'warning', 'danger', 'success')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_status_enum" AS ENUM('pending', 'sent', 'read', 'failed')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "message" text NOT NULL, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'info', "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'pending', "metadata" jsonb, "actionUrl" character varying, "userId" uuid NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "sentAt" TIMESTAMP, "readAt" TIMESTAMP, "error" text, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "baseSalary" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "user_chat_roles" DROP COLUMN "chatType"`);
        // 1. Add as nullable
await queryRunner.query(`ALTER TABLE "user_chat_roles" ADD "chatType" character varying(32)`);
// 2. Fill existing rows with a default value
await queryRunner.query(`UPDATE "user_chat_roles" SET "chatType" = 'private' WHERE "chatType" IS NULL`);
// 3. Set NOT NULL constraint
await queryRunner.query(`ALTER TABLE "user_chat_roles" ALTER COLUMN "chatType" SET NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."message_logs_senderroleatmoment_enum" RENAME TO "message_logs_senderroleatmoment_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."message_logs_senderroleatmoment_enum" AS ENUM('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT')`);
        await queryRunner.query(`ALTER TABLE "message_logs" ALTER COLUMN "senderRoleAtMoment" TYPE "public"."message_logs_senderroleatmoment_enum" USING "senderRoleAtMoment"::"text"::"public"."message_logs_senderroleatmoment_enum"`);
        await queryRunner.query(`DROP TYPE "public"."message_logs_senderroleatmoment_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."report_types_responsibleroles_enum" RENAME TO "report_types_responsibleroles_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."report_types_responsibleroles_enum" AS ENUM('ADMIN', 'SUPERVISOR', 'NAZORATCHI', 'AGENT', 'BANK_CLIENT', 'BOT')`);
        await queryRunner.query(`ALTER TABLE "report_types" ALTER COLUMN "responsibleRoles" TYPE "public"."report_types_responsibleroles_enum"[] USING "responsibleRoles"::"text"::"public"."report_types_responsibleroles_enum"[]`);
        await queryRunner.query(`DROP TYPE "public"."report_types_responsibleroles_enum_old"`);
        await queryRunner.query(`ALTER TABLE "message_responses" ADD CONSTRAINT "FK_26cbad80491534329b1bdf91e40" FOREIGN KEY ("originalMessageId") REFERENCES "message_logs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kpi_scores" ADD CONSTRAINT "FK_25b9a6308c011cddfed06e29a5a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kpi_reports" ADD CONSTRAINT "FK_295617e68febbc428b91aab6d47" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`ALTER TABLE "kpi_reports" DROP CONSTRAINT "FK_295617e68febbc428b91aab6d47"`);
        await queryRunner.query(`ALTER TABLE "kpi_scores" DROP CONSTRAINT "FK_25b9a6308c011cddfed06e29a5a"`);
        await queryRunner.query(`ALTER TABLE "message_responses" DROP CONSTRAINT "FK_26cbad80491534329b1bdf91e40"`);
        await queryRunner.query(`CREATE TYPE "public"."report_types_responsibleroles_enum_old" AS ENUM('ADMIN', 'SUPERVISOR', 'AGENT', 'BANK_CLIENT', 'BOT', 'NAZORATCHI', 'BUXGALTER', 'BANK_KLIENT')`);
        await queryRunner.query(`ALTER TABLE "report_types" ALTER COLUMN "responsibleRoles" TYPE "public"."report_types_responsibleroles_enum_old"[] USING "responsibleRoles"::"text"::"public"."report_types_responsibleroles_enum_old"[]`);
        await queryRunner.query(`DROP TYPE "public"."report_types_responsibleroles_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."report_types_responsibleroles_enum_old" RENAME TO "report_types_responsibleroles_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."message_logs_senderroleatmoment_enum_old" AS ENUM('ADMIN', 'SUPERVISOR', 'AGENT', 'BANK_CLIENT', 'BOT', 'NAZORATCHI', 'BUXGALTER', 'BANK_KLIENT')`);
        await queryRunner.query(`ALTER TABLE "message_logs" ALTER COLUMN "senderRoleAtMoment" TYPE "public"."message_logs_senderroleatmoment_enum_old" USING "senderRoleAtMoment"::"text"::"public"."message_logs_senderroleatmoment_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."message_logs_senderroleatmoment_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."message_logs_senderroleatmoment_enum_old" RENAME TO "message_logs_senderroleatmoment_enum"`);
        await queryRunner.query(`ALTER TABLE "user_chat_roles" DROP COLUMN "chatType"`);
        await queryRunner.query(`ALTER TABLE "user_chat_roles" ADD "chatType" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "baseSalary"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a6bb61c15b68b3aa2f07e1b1a"`);
        await queryRunner.query(`DROP TABLE "kpi_reports"`);
        await queryRunner.query(`DROP TYPE "public"."kpi_reports_userrole_enum"`);
        await queryRunner.query(`DROP TYPE "public"."kpi_reports_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2785d3cec73fa17e9804814011"`);
        await queryRunner.query(`DROP TABLE "kpi_scores"`);
        await queryRunner.query(`DROP TYPE "public"."kpi_scores_role_enum"`);
        await queryRunner.query(`DROP TABLE "message_responses"`);
    }

}
