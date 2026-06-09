import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "enable_logging" boolean DEFAULT false;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "message_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "join_leave_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "member_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "profile_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "server_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "new_account_flag_days" numeric DEFAULT 7;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "attach_profile_link" boolean DEFAULT true;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "enable_logging";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "message_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "join_leave_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "member_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "profile_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "server_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "new_account_flag_days";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "attach_profile_link";
  `)
}
