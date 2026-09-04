import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * FACEIT added an Intermediate division between Advanced and Open (NA + EMEA,
 * 2026-09). matches.league is the only division stored as a Postgres enum;
 * faceit_leagues.division, faceit_seasons.division and the tournament template
 * rule division are text columns and need no change.
 * Additive only. ALTER TYPE ... ADD VALUE cannot run inside a transaction
 * block. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(
    sql`ALTER TYPE "public"."enum_matches_league" ADD VALUE IF NOT EXISTS 'Intermediate' AFTER 'Advanced';`,
  )
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop enum values.
}
