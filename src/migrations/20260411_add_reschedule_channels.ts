import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Create the array table for reschedule notification channels
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "production_dashboard_reschedule_notification_channels" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "channel_id" varchar NOT NULL,
      "label" varchar NOT NULL
    );

    -- Add foreign key to the parent global
    DO $$ BEGIN
      ALTER TABLE "production_dashboard_reschedule_notification_channels"
        ADD CONSTRAINT "production_dashboard_reschedule_notification_channels_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "production_dashboard"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create index for ordering
    CREATE INDEX IF NOT EXISTS "production_dashboard_reschedule_notification_channels_order_idx"
      ON "production_dashboard_reschedule_notification_channels" ("_order");

    CREATE INDEX IF NOT EXISTS "production_dashboard_reschedule_notification_channels_parent_id_idx"
      ON "production_dashboard_reschedule_notification_channels" ("_parent_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "production_dashboard_reschedule_notification_channels";
  `)
}
