import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Per-team day when next week's availability calendar opens for voting.
  // varchar (not pg enum) to match how other team selects are stored in prod.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams"
      ADD COLUMN IF NOT EXISTS "next_week_release_day" varchar DEFAULT 'friday';
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams"
      DROP COLUMN IF EXISTS "next_week_release_day";
  `)
}
