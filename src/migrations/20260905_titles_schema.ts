import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Titles and access, migration A (schema, additive):
 * - people_titles array table (+ people_titles_regions hasMany select)
 * - people_rels.path 'assignedTeams' -> 'teamAccess'
 * Apply by hand before deploying the titles build. organization_staff / production untouched.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_people_titles_title" AS ENUM('owner','co-owner','administration','hr','region-lead','event-manager','social-manager','marketing','graphics','media-editor','caster','observer','producer','content-creator');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_people_titles_regions" AS ENUM('na','emea','sa','oce','apac','sea');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "people_titles" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" "enum_people_titles_title" NOT NULL,
      "is_lead" boolean DEFAULT false
    );
    DO $$ BEGIN
      ALTER TABLE "people_titles" ADD CONSTRAINT "people_titles_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "people_titles_order_idx" ON "people_titles" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "people_titles_parent_id_idx" ON "people_titles" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "people_titles_title_idx" ON "people_titles" USING btree ("title");
  `)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "people_titles_regions" (
      "order" integer NOT NULL,
      "parent_id" varchar NOT NULL,
      "value" "enum_people_titles_regions",
      "id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text
    );
    DO $$ BEGIN
      ALTER TABLE "people_titles_regions" ADD CONSTRAINT "people_titles_regions_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."people_titles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "people_titles_regions_order_idx" ON "people_titles_regions" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "people_titles_regions_parent_idx" ON "people_titles_regions" USING btree ("parent_id");
  `)
  await payload.db.drizzle.execute(sql`
    UPDATE "people_rels" SET "path" = 'teamAccess' WHERE "path" = 'assignedTeams';
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    UPDATE "people_rels" SET "path" = 'assignedTeams' WHERE "path" = 'teamAccess';
  `)
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "people_titles_regions";
    DROP TABLE IF EXISTS "people_titles";
    DROP TYPE IF EXISTS "enum_people_titles_regions";
    DROP TYPE IF EXISTS "enum_people_titles_title";
  `)
}
