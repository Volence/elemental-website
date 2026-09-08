import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Schema drift repair: `availability_calendars` reached production without the three
 * relationship columns the collection declares (`team`, `createdBy`, `linkedSchedule`), and
 * `discord_polls` without `availabilityChangedAfterSchedule`. The columns only ever existed in
 * databases Payload had pushed to, so no migration created them and production has been running
 * a collection it cannot read or write. The gap also breaks the people merge tool, which sweeps
 * every people FK column and hits `availability_calendars.created_by_id`.
 *
 * Additive and idempotent - safe to run on a database that already has the columns. The table is
 * empty on production, so `team` being a required field costs no backfill.
 * Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "availability_calendars" ADD COLUMN IF NOT EXISTS "team_id" integer;
    ALTER TABLE "availability_calendars" ADD COLUMN IF NOT EXISTS "created_by_id" integer;
    ALTER TABLE "availability_calendars" ADD COLUMN IF NOT EXISTS "linked_schedule_id" integer;
    ALTER TABLE "discord_polls" ADD COLUMN IF NOT EXISTS "availability_changed_after_schedule" boolean;
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "availability_calendars" ADD CONSTRAINT "availability_calendars_team_id_fk"
        FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "availability_calendars" ADD CONSTRAINT "availability_calendars_created_by_id_people_fk"
        FOREIGN KEY ("created_by_id") REFERENCES "public"."people"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "availability_calendars" ADD CONSTRAINT "availability_calendars_linked_schedule_id_fk"
        FOREIGN KEY ("linked_schedule_id") REFERENCES "public"."discord_polls"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "availability_calendars_team_idx" ON "availability_calendars" USING btree ("team_id");
    CREATE INDEX IF NOT EXISTS "availability_calendars_linked_schedule_idx" ON "availability_calendars" USING btree ("linked_schedule_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "availability_calendars" DROP COLUMN IF EXISTS "team_id";
    ALTER TABLE "availability_calendars" DROP COLUMN IF EXISTS "created_by_id";
    ALTER TABLE "availability_calendars" DROP COLUMN IF EXISTS "linked_schedule_id";
    ALTER TABLE "discord_polls" DROP COLUMN IF EXISTS "availability_changed_after_schedule";
  `)
}
