import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // discord_clone_jobs: one row per "clone the primary server into a target" run.
  // Holds live progress, the per-item report, the submitted selection, and any error.
  // Adding a collection also requires the matching relationship column on
  // payload_locked_documents_rels (column + FK + index), or Payload's admin
  // "locked documents" query fails with a missing-column error.
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_discord_clone_jobs_status" AS ENUM('pending', 'running', 'completed', 'failed');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "discord_clone_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "target_guild_id" varchar NOT NULL,
      "status" "enum_discord_clone_jobs_status" DEFAULT 'pending' NOT NULL,
      "progress" jsonb,
      "report" jsonb,
      "selection" jsonb,
      "error" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "discord_clone_jobs_updated_at_idx" ON "discord_clone_jobs" ("updated_at");
    CREATE INDEX IF NOT EXISTS "discord_clone_jobs_created_at_idx" ON "discord_clone_jobs" ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discord_clone_jobs_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_discord_clone_jobs_fk"
        FOREIGN KEY ("discord_clone_jobs_id") REFERENCES "public"."discord_clone_jobs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_discord_clone_jobs_id_idx"
      ON "payload_locked_documents_rels" ("discord_clone_jobs_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discord_clone_jobs_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_discord_clone_jobs_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discord_clone_jobs_id";
    DROP TABLE IF EXISTS "discord_clone_jobs";
    DROP TYPE IF EXISTS "public"."enum_discord_clone_jobs_status";
  `)
}
