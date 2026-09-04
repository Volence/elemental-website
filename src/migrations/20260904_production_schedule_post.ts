import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Production schedule post to Discord:
 * - two channel ids on the production-dashboard global (staff + public)
 * - the schedulePost group that remembers which Discord messages back the
 *   current week's post so later saves edit in place
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "production_dashboard"
      ADD COLUMN IF NOT EXISTS "schedule_staff_channel_id" varchar,
      ADD COLUMN IF NOT EXISTS "schedule_public_channel_id" varchar,
      ADD COLUMN IF NOT EXISTS "schedule_post_staff_message_ids" varchar,
      ADD COLUMN IF NOT EXISTS "schedule_post_public_message_ids" varchar,
      ADD COLUMN IF NOT EXISTS "schedule_post_match_ids" varchar,
      ADD COLUMN IF NOT EXISTS "schedule_post_posted_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "schedule_post_posted_by" varchar;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "production_dashboard"
      DROP COLUMN IF EXISTS "schedule_staff_channel_id",
      DROP COLUMN IF EXISTS "schedule_public_channel_id",
      DROP COLUMN IF EXISTS "schedule_post_staff_message_ids",
      DROP COLUMN IF EXISTS "schedule_post_public_message_ids",
      DROP COLUMN IF EXISTS "schedule_post_match_ids",
      DROP COLUMN IF EXISTS "schedule_post_posted_at",
      DROP COLUMN IF EXISTS "schedule_post_posted_by";
  `)
}
