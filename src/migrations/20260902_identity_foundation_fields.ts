import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Identity foundation (step 1 of identity consolidation):
 * - people.username (Payload loginWithUsername; Discord-created rows use username = discord_id)
 * - people.discord_username / discord_avatar (refreshed on Discord login)
 * - people.is_inactive / merged_into_id (archive instead of delete)
 * - discord_servers.identity_claims_channel_id
 * - identity_claims table
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "username" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "people_username_idx" ON "people" USING btree ("username");
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "discord_username" varchar;
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "discord_avatar" varchar;
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "is_inactive" boolean DEFAULT false;
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "merged_into_id" integer;
    CREATE INDEX IF NOT EXISTS "people_is_inactive_idx" ON "people" USING btree ("is_inactive");
    CREATE INDEX IF NOT EXISTS "people_merged_into_idx" ON "people" USING btree ("merged_into_id");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "people" ADD CONSTRAINT "people_merged_into_id_people_id_fk"
        FOREIGN KEY ("merged_into_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "identity_claims_channel_id" varchar;
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_identity_claims_status" AS ENUM('pending', 'approved', 'declined');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "identity_claims" (
      "id" serial PRIMARY KEY NOT NULL,
      "claimant_id" integer NOT NULL,
      "target_id" integer NOT NULL,
      "status" "enum_identity_claims_status" DEFAULT 'pending' NOT NULL,
      "reviewer_id" integer,
      "reviewed_at" timestamp(3) with time zone,
      "note" varchar,
      "discord_snapshot" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "identity_claims_claimant_target_idx" ON "identity_claims" ("claimant_id", "target_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_claimant_idx" ON "identity_claims" ("claimant_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_target_idx" ON "identity_claims" ("target_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_status_idx" ON "identity_claims" ("status");
    CREATE INDEX IF NOT EXISTS "identity_claims_reviewer_idx" ON "identity_claims" ("reviewer_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_updated_at_idx" ON "identity_claims" ("updated_at");
    CREATE INDEX IF NOT EXISTS "identity_claims_created_at_idx" ON "identity_claims" ("created_at");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "identity_claims" ADD CONSTRAINT "identity_claims_claimant_id_people_id_fk"
        FOREIGN KEY ("claimant_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "identity_claims" ADD CONSTRAINT "identity_claims_target_id_people_id_fk"
        FOREIGN KEY ("target_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "identity_claims" ADD CONSTRAINT "identity_claims_reviewer_id_people_id_fk"
        FOREIGN KEY ("reviewer_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  // Payload tracks document locks per collection in this rels table.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "identity_claims_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_identity_claims_fk"
        FOREIGN KEY ("identity_claims_id") REFERENCES "public"."identity_claims"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_identity_claims_id_idx"
      ON "payload_locked_documents_rels" USING btree ("identity_claims_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "identity_claims_id";
    DROP TABLE IF EXISTS "identity_claims";
    DROP TYPE IF EXISTS "enum_identity_claims_status";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "identity_claims_channel_id";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "merged_into_id";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "is_inactive";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "discord_avatar";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "discord_username";
    DROP INDEX IF EXISTS "people_username_idx";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "username";
  `)
}
