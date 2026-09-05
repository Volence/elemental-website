import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Guides (in-app onboarding, Me > Guides):
 * - guides table with audience checkboxes (group fields flatten to columns)
 * - guides_sections array table
 * - people.guide_progress jsonb (per-person ticks + dismissed dashboard card)
 * - payload_locked_documents_rels.guides_id, which Payload's admin needs for any new collection
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "guides" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "summary" varchar,
      "order" numeric DEFAULT 100,
      "published" boolean DEFAULT true,
      "audience_everyone" boolean DEFAULT false,
      "audience_roles_admin" boolean DEFAULT false,
      "audience_roles_staff_manager" boolean DEFAULT false,
      "audience_roles_team_manager" boolean DEFAULT false,
      "audience_roles_player" boolean DEFAULT false,
      "audience_roles_user" boolean DEFAULT false,
      "audience_departments_production" boolean DEFAULT false,
      "audience_departments_social_media" boolean DEFAULT false,
      "audience_departments_graphics" boolean DEFAULT false,
      "audience_departments_video" boolean DEFAULT false,
      "audience_departments_events" boolean DEFAULT false,
      "audience_departments_scouting" boolean DEFAULT false,
      "audience_departments_content_creator" boolean DEFAULT false,
      "audience_departments_pug_admin" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "guides_slug_idx" ON "guides" ("slug");
    CREATE INDEX IF NOT EXISTS "guides_updated_at_idx" ON "guides" ("updated_at");
    CREATE INDEX IF NOT EXISTS "guides_created_at_idx" ON "guides" ("created_at");

    CREATE TABLE IF NOT EXISTS "guides_sections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "body" varchar,
      "link_label" varchar,
      "link_href" varchar,
      "image_id" integer
    );
    DO $$ BEGIN
      ALTER TABLE "guides_sections" ADD CONSTRAINT "guides_sections_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "guides_sections" ADD CONSTRAINT "guides_sections_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "guides_sections_order_idx" ON "guides_sections" ("_order");
    CREATE INDEX IF NOT EXISTS "guides_sections_parent_id_idx" ON "guides_sections" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "guides_sections_image_idx" ON "guides_sections" ("image_id");

    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "guide_progress" jsonb;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "guides_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guides_fk"
        FOREIGN KEY ("guides_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_guides_id_idx" ON "payload_locked_documents_rels" ("guides_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_guides_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_guides_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "guides_id";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "guide_progress";
    DROP TABLE IF EXISTS "guides_sections";
    DROP TABLE IF EXISTS "guides";
  `)
}
