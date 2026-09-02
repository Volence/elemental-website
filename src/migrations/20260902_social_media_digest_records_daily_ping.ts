import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Social media dashboard follow-ups:
 * - digest_posts: JSON list of the weekly digest messages the bot has sent
 *   (week start, channel, message id) so a re-post edits the existing message.
 * - daily_ping_*: morning-of "posts due today" reminder settings.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "digest_posts" jsonb;
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "daily_ping_enabled" boolean DEFAULT false;
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "daily_ping_channel_id" varchar;
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "daily_ping_time" varchar DEFAULT '09:00';
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "daily_ping_timezone" varchar DEFAULT 'America/New_York';
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "daily_ping_last_sent" varchar;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "digest_posts";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "daily_ping_enabled";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "daily_ping_channel_id";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "daily_ping_time";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "daily_ping_timezone";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "daily_ping_last_sent";
  `)
}
