import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * teams.faceit_withdrawn: team dropped out of the current FACEIT season.
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "faceit_withdrawn" boolean DEFAULT false;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`ALTER TABLE "teams" DROP COLUMN IF EXISTS "faceit_withdrawn";`)
}
