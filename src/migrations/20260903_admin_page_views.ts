import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Admin page-view telemetry (UX program P2):
 * - admin_page_views table (person_id, path, role, timestamps)
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "admin_page_views" (
      "id" serial PRIMARY KEY NOT NULL,
      "person_id" integer,
      "path" varchar NOT NULL,
      "role" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "admin_page_views_person_idx" ON "admin_page_views" USING btree ("person_id");
    CREATE INDEX IF NOT EXISTS "admin_page_views_path_idx" ON "admin_page_views" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "admin_page_views_updated_at_idx" ON "admin_page_views" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "admin_page_views_created_at_idx" ON "admin_page_views" USING btree ("created_at");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "admin_page_views" ADD CONSTRAINT "admin_page_views_person_id_people_id_fk"
        FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  // Payload tracks document locks per collection in this rels table.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "admin_page_views_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_page_views_fk"
        FOREIGN KEY ("admin_page_views_id") REFERENCES "public"."admin_page_views"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_admin_page_views_id_idx"
      ON "payload_locked_documents_rels" USING btree ("admin_page_views_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "admin_page_views_id";
    DROP TABLE IF EXISTS "admin_page_views";
  `)
}
