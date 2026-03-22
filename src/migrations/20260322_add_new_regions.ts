import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Add new region values to the teams region enum
  await payload.db.drizzle.execute(sql`
    ALTER TYPE "public"."enum_teams_region" ADD VALUE IF NOT EXISTS 'OCE';
    ALTER TYPE "public"."enum_teams_region" ADD VALUE IF NOT EXISTS 'SEA';
    ALTER TYPE "public"."enum_teams_region" ADD VALUE IF NOT EXISTS 'APAC';
    ALTER TYPE "public"."enum_teams_region" ADD VALUE IF NOT EXISTS 'China';
  `)

  // Add new region values to the matches region enum
  await payload.db.drizzle.execute(sql`
    ALTER TYPE "public"."enum_matches_region" ADD VALUE IF NOT EXISTS 'OCE';
    ALTER TYPE "public"."enum_matches_region" ADD VALUE IF NOT EXISTS 'SEA';
    ALTER TYPE "public"."enum_matches_region" ADD VALUE IF NOT EXISTS 'APAC';
    ALTER TYPE "public"."enum_matches_region" ADD VALUE IF NOT EXISTS 'China';
  `)

  // Normalize opponent_teams region values from lowercase to uppercase
  // and add new region values (this collection was using lowercase values)
  await payload.db.drizzle.execute(sql`
    UPDATE "opponent_teams" SET "region" = 'NA' WHERE "region" = 'na';
    UPDATE "opponent_teams" SET "region" = 'EU' WHERE "region" = 'eu';
    UPDATE "opponent_teams" SET "region" = 'SA' WHERE "region" = 'sa';
    UPDATE "opponent_teams" SET "region" = 'APAC' WHERE "region" = 'apac';
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  // PostgreSQL does not support removing enum values directly.
  // The enum values will remain but won't be selectable in the UI.
  // To fully reverse, you would need to recreate the enum types.

  // Revert opponent_teams region values back to lowercase
  await payload.db.drizzle.execute(sql`
    UPDATE "opponent_teams" SET "region" = 'na' WHERE "region" = 'NA';
    UPDATE "opponent_teams" SET "region" = 'eu' WHERE "region" = 'EU';
    UPDATE "opponent_teams" SET "region" = 'sa' WHERE "region" = 'SA';
    UPDATE "opponent_teams" SET "region" = 'apac' WHERE "region" = 'APAC';
  `)
}
