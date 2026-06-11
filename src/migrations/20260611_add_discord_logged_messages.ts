import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "discord_logged_messages" (
      "id" serial PRIMARY KEY NOT NULL,
      "message_id" varchar NOT NULL,
      "guild_id" varchar NOT NULL,
      "channel_id" varchar NOT NULL,
      "author_id" varchar NOT NULL,
      "author_tag" varchar NOT NULL,
      "content" varchar,
      "attachments" jsonb,
      "sent_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "dlm_message_id_idx" ON "discord_logged_messages" ("message_id");
    CREATE INDEX IF NOT EXISTS "dlm_guild_id_idx" ON "discord_logged_messages" ("guild_id");
    CREATE INDEX IF NOT EXISTS "dlm_sent_at_idx" ON "discord_logged_messages" ("sent_at");
    CREATE INDEX IF NOT EXISTS "dlm_updated_at_idx" ON "discord_logged_messages" ("updated_at");
    CREATE INDEX IF NOT EXISTS "dlm_created_at_idx" ON "discord_logged_messages" ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discord_logged_messages_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_discord_logged_messages_fk"
        FOREIGN KEY ("discord_logged_messages_id") REFERENCES "public"."discord_logged_messages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_discord_logged_messages_id_idx" ON "payload_locked_documents_rels" ("discord_logged_messages_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discord_logged_messages_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_discord_logged_messages_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discord_logged_messages_id";
    DROP TABLE IF EXISTS "discord_logged_messages";
  `)
}
