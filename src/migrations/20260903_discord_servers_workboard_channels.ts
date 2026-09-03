import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Workboard request notifications (UX program P8):
 * discord_servers.workboard_channels_* - one optional channel id per department
 * plus a fallback. Additive only. Apply on prod by hand before deploying.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_graphics" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_video" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_events" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_scouting" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_production" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_social_media" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "workboard_channels_fallback" varchar;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_graphics";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_video";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_events";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_scouting";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_production";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_social_media";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "workboard_channels_fallback";
  `)
}
