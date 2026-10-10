import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload 3.90 added a hidden auth field, resetPasswordRequestedAt, to the People collection
 * (forgot-password rate limiting). The image installs the newest Payload 3.x on every build, so
 * prod picked it up without the column and every People read failed. Applied on prod by hand
 * 2026-10-10.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "people" DROP COLUMN IF EXISTS "reset_password_requested_at";
  `)
}
