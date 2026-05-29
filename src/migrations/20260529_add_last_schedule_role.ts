import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Per-team remembered schedule role, auto-filled by the scheduler so a
  // player's role carries forward week-to-week without re-entry.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams_roster"
      ADD COLUMN IF NOT EXISTS "last_schedule_role" varchar;
    ALTER TABLE "teams_subs"
      ADD COLUMN IF NOT EXISTS "last_schedule_role" varchar;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams_roster"
      DROP COLUMN IF EXISTS "last_schedule_role";
    ALTER TABLE "teams_subs"
      DROP COLUMN IF EXISTS "last_schedule_role";
  `)
}
