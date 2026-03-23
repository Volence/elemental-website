import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Add dateChanged and previousDate columns to matches productionWorkflow
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "production_workflow_date_changed" boolean DEFAULT false;
    ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "production_workflow_previous_date" timestamp(3) with time zone;
  `)

  // Add productionNotificationsChannelId to production_dashboard global
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "production_dashboard" ADD COLUMN IF NOT EXISTS "production_notifications_channel_id" varchar;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "matches" DROP COLUMN IF EXISTS "production_workflow_date_changed";
    ALTER TABLE "matches" DROP COLUMN IF EXISTS "production_workflow_previous_date";
    ALTER TABLE "production_dashboard" DROP COLUMN IF EXISTS "production_notifications_channel_id";
  `)
}

