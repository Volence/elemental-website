import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Create enums for team type fields
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_matches_team1_type" AS ENUM('internal', 'external');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_matches_team2_type" AS ENUM('internal', 'external');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Add new columns to matches table
  await payload.db.drizzle.execute(sql`
    -- Team 1 flexible fields
    ALTER TABLE "matches" 
      ADD COLUMN IF NOT EXISTS "team1_type" "enum_matches_team1_type" DEFAULT 'internal',
      ADD COLUMN IF NOT EXISTS "team1_internal_id" integer,
      ADD COLUMN IF NOT EXISTS "team1_external" varchar;

    -- Team 2 flexible fields  
    ALTER TABLE "matches"
      ADD COLUMN IF NOT EXISTS "team2_type" "enum_matches_team2_type" DEFAULT 'external',
      ADD COLUMN IF NOT EXISTS "team2_internal_id" integer,
      ADD COLUMN IF NOT EXISTS "team2_external" varchar;

    -- Tournament slot flag
    ALTER TABLE "matches"
      ADD COLUMN IF NOT EXISTS "is_tournament_slot" boolean DEFAULT false;

    -- Add foreign key for team1_internal_id
    ALTER TABLE "matches" 
      ADD CONSTRAINT "matches_team1_internal_id_teams_id_fk" 
      FOREIGN KEY ("team1_internal_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    -- Add foreign key for team2_internal_id
    ALTER TABLE "matches" 
      ADD CONSTRAINT "matches_team2_internal_id_teams_id_fk" 
      FOREIGN KEY ("team2_internal_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "matches_team1_internal_idx" ON "matches" USING btree ("team1_internal_id");
    CREATE INDEX IF NOT EXISTS "matches_team2_internal_idx" ON "matches" USING btree ("team2_internal_id");
    CREATE INDEX IF NOT EXISTS "matches_is_tournament_slot_idx" ON "matches" USING btree ("is_tournament_slot");
  `)

  // Add 'Other' option to league enum if not exists
  await payload.db.drizzle.execute(sql`
    ALTER TYPE "enum_matches_league" ADD VALUE IF NOT EXISTS 'Other';
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Drop indexes
    DROP INDEX IF EXISTS "matches_team1_internal_idx";
    DROP INDEX IF EXISTS "matches_team2_internal_idx";
    DROP INDEX IF EXISTS "matches_is_tournament_slot_idx";

    -- Drop foreign keys
    ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_team1_internal_id_teams_id_fk";
    ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_team2_internal_id_teams_id_fk";

    -- Drop columns
    ALTER TABLE "matches"
      DROP COLUMN IF EXISTS "team1_type",
      DROP COLUMN IF EXISTS "team1_internal_id",
      DROP COLUMN IF EXISTS "team1_external",
      DROP COLUMN IF EXISTS "team2_type",
      DROP COLUMN IF EXISTS "team2_internal_id",
      DROP COLUMN IF EXISTS "team2_external",
      DROP COLUMN IF EXISTS "is_tournament_slot";

    -- Drop enums
    DROP TYPE IF EXISTS "enum_matches_team1_type";
    DROP TYPE IF EXISTS "enum_matches_team2_type";
  `)
}
