import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Add the new top-level ban_offense_count column, copying existing values
    ALTER TABLE "pug_players"
      ADD COLUMN IF NOT EXISTS "ban_offense_count" numeric DEFAULT 0;

    -- Migrate existing offense counts from the activeBan group column
    UPDATE "pug_players"
      SET "ban_offense_count" = "active_ban_offense_count"
      WHERE "active_ban_offense_count" IS NOT NULL AND "active_ban_offense_count" != 0;

    -- Remove the old column that lived inside the activeBan group
    ALTER TABLE "pug_players"
      DROP COLUMN IF EXISTS "active_ban_offense_count";
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Restore the old column inside the activeBan group
    ALTER TABLE "pug_players"
      ADD COLUMN IF NOT EXISTS "active_ban_offense_count" numeric DEFAULT 0;

    -- Migrate data back
    UPDATE "pug_players"
      SET "active_ban_offense_count" = "ban_offense_count"
      WHERE "ban_offense_count" IS NOT NULL AND "ban_offense_count" != 0;

    -- Drop the new top-level column
    ALTER TABLE "pug_players"
      DROP COLUMN IF EXISTS "ban_offense_count";
  `)
}
