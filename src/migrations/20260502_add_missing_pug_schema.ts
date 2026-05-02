import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Create enum for invite regions on pug_players
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_pug_players_invite_regions" AS ENUM('na', 'emea', 'pacific');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // 2. Create the pug_players_invite_regions join table (matches pug_players_tiers pattern)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "pug_players_invite_regions" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "id" character varying PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
      "value" "enum_pug_players_invite_regions"
    );
  `)

  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "pug_players_invite_regions_order_idx" ON "pug_players_invite_regions" ("order");
    CREATE INDEX IF NOT EXISTS "pug_players_invite_regions_parent_id_idx" ON "pug_players_invite_regions" ("parent_id");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pug_players_invite_regions"
        ADD CONSTRAINT "pug_players_invite_regions_parent_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "pug_players"("id") ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // 3. Add region column to pug_leaderboard
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_pug_leaderboard_region" AS ENUM('na', 'emea', 'pacific');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_leaderboard"
      ADD COLUMN IF NOT EXISTS "region" "enum_pug_leaderboard_region";
  `)

  // 4. Update unique constraint to include region for invite-tier entries
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "pug_leaderboard_player_season_tier_unique";
    CREATE UNIQUE INDEX "pug_leaderboard_player_season_tier_unique" ON "pug_leaderboard" ("player_id", "season_id", "tier", "region");
  `)

  // 5. Add pugInvite group columns to invite_links
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "invite_links"
      ADD COLUMN IF NOT EXISTS "pug_invite_is_for_pug" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pug_invite_region" varchar;
  `)

  // 6. Create enum and join table for invite_links pugInvite.approvedRoles
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_invite_links_pug_invite_approved_roles" AS ENUM('tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "invite_links_pug_invite_approved_roles" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "id" character varying PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
      "value" "enum_invite_links_pug_invite_approved_roles"
    );
  `)

  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "invite_links_pug_invite_approved_roles_order_idx" ON "invite_links_pug_invite_approved_roles" ("order");
    CREATE INDEX IF NOT EXISTS "invite_links_pug_invite_approved_roles_parent_id_idx" ON "invite_links_pug_invite_approved_roles" ("parent_id");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "invite_links_pug_invite_approved_roles"
        ADD CONSTRAINT "invite_links_pug_invite_approved_roles_parent_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "invite_links"("id") ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // 7. Add isPugAdmin to invite_links departments
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "invite_links"
      ADD COLUMN IF NOT EXISTS "departments_is_pug_admin" boolean DEFAULT false;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  // Revert unique constraint to exclude region
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "pug_leaderboard_player_season_tier_unique";
    CREATE UNIQUE INDEX "pug_leaderboard_player_season_tier_unique" ON "pug_leaderboard" ("player_id", "season_id", "tier");
  `)

  // Remove region column from pug_leaderboard
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_leaderboard" DROP COLUMN IF EXISTS "region";
    DROP TYPE IF EXISTS "enum_pug_leaderboard_region";
  `)

  // Drop invite_regions join table
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "pug_players_invite_regions";
    DROP TYPE IF EXISTS "enum_pug_players_invite_regions";
  `)

  // Drop invite_links pugInvite fields
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "invite_links_pug_invite_approved_roles";
    DROP TYPE IF EXISTS "enum_invite_links_pug_invite_approved_roles";
  `)

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "invite_links"
      DROP COLUMN IF EXISTS "pug_invite_is_for_pug",
      DROP COLUMN IF EXISTS "pug_invite_region",
      DROP COLUMN IF EXISTS "departments_is_pug_admin";
  `)
}
