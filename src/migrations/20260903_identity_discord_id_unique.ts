import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Unique discord_id. Fails loudly if duplicates remain (run 20260902_identity_duplicate_report first).
 * CONCURRENTLY cannot run inside a transaction, so on prod apply the statement directly in psql.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "people_discord_id_unique" ON "people" ("discord_id") WHERE "discord_id" IS NOT NULL;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`DROP INDEX IF EXISTS "people_discord_id_unique";`)
}
