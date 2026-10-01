import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Name-only production staff on a match (productionWorkflow.placeholderStaff), for someone who
 * works the match but could not sign up. Additive only. Apply on prod by hand before deploying
 * the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "placeholder_staff" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "role" varchar NOT NULL,
      "name" varchar NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "placeholder_staff"
        ADD CONSTRAINT "placeholder_staff_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "placeholder_staff_order_idx" ON "placeholder_staff" ("_order");
    CREATE INDEX IF NOT EXISTS "placeholder_staff_parent_id_idx" ON "placeholder_staff" ("_parent_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`DROP TABLE IF EXISTS "placeholder_staff";`)
}
