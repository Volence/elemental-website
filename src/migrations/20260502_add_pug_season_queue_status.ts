import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_seasons"
      ADD COLUMN IF NOT EXISTS "region_queue_status_na" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "region_queue_status_emea" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "region_queue_status_pacific" boolean DEFAULT false;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_seasons"
      DROP COLUMN IF EXISTS "region_queue_status_na",
      DROP COLUMN IF EXISTS "region_queue_status_emea",
      DROP COLUMN IF EXISTS "region_queue_status_pacific";
  `)
}
