import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * PUG South America region:
 * - 'sa' on the three region enums (leaderboard rows, People invite regions,
 *   archived pug_players invite regions)
 * - pug_seasons.region_queue_status_sa for the invite-tier queue toggle
 * Additive only. ALTER TYPE ... ADD VALUE cannot run inside a transaction
 * block, so each statement is executed on its own. Apply on prod by hand
 * before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const db = payload.db.drizzle
  await db.execute(sql`ALTER TYPE "public"."enum_pug_leaderboard_region" ADD VALUE IF NOT EXISTS 'sa';`)
  await db.execute(sql`ALTER TYPE "public"."enum_people_pug_invite_regions" ADD VALUE IF NOT EXISTS 'sa';`)
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_pug_players_invite_regions') THEN
        ALTER TYPE "public"."enum_pug_players_invite_regions" ADD VALUE IF NOT EXISTS 'sa';
      END IF;
    END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "pug_seasons"
      ADD COLUMN IF NOT EXISTS "region_queue_status_sa" boolean DEFAULT false;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop enum values; the column is the only reversible part.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_seasons" DROP COLUMN IF EXISTS "region_queue_status_sa";
  `)
}
