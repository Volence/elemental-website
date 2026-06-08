import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "discord_servers" (
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "guild_id" varchar NOT NULL,
      "region" varchar,
      "is_primary" boolean DEFAULT false,
      "active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "discord_servers_guild_id_idx" ON "discord_servers" ("guild_id");
    CREATE INDEX IF NOT EXISTS "discord_servers_updated_at_idx" ON "discord_servers" ("updated_at");
    CREATE INDEX IF NOT EXISTS "discord_servers_created_at_idx" ON "discord_servers" ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discord_servers_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_discord_servers_fk"
        FOREIGN KEY ("discord_servers_id") REFERENCES "public"."discord_servers"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_discord_servers_id_idx"
      ON "payload_locked_documents_rels" ("discord_servers_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discord_servers_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_discord_servers_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discord_servers_id";
    DROP TABLE IF EXISTS "discord_servers";
  `)
}
