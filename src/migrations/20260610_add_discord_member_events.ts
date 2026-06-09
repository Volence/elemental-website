import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "discord_member_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "guild_id" varchar NOT NULL,
      "discord_user_id" varchar NOT NULL,
      "event_type" varchar NOT NULL,
      "occurred_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "dme_guild_user_idx" ON "discord_member_events" ("guild_id","discord_user_id");
    CREATE INDEX IF NOT EXISTS "dme_updated_at_idx" ON "discord_member_events" ("updated_at");
    CREATE INDEX IF NOT EXISTS "dme_created_at_idx" ON "discord_member_events" ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discord_member_events_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_discord_member_events_fk"
        FOREIGN KEY ("discord_member_events_id") REFERENCES "public"."discord_member_events"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "pld_rels_dme_id_idx" ON "payload_locked_documents_rels" ("discord_member_events_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discord_member_events_fk";
    DROP INDEX IF EXISTS "pld_rels_dme_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discord_member_events_id";
    DROP TABLE IF EXISTS "discord_member_events";
  `)
}
