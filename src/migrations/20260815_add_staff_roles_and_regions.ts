import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Closes org-staff schema drift:
 * 1. Commit da63ec37 (2026-05-07) replaced Moderator with Region Lead in the
 *    collection config but never shipped a migration - the enum lacks
 *    'region-lead' and the `organization_staff_regions` table was never created.
 * 2. Adds the new 'administration' and 'marketing' roles (2026-08-15).
 * 3. Removes 'moderator' role assignments (role retired). The enum keeps the
 *    dead 'moderator' value - Postgres cannot drop enum values without
 *    recreating the type. BEFORE APPLYING: report current moderator holders.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // New values are appended at the end, so enum physical order now differs
  // from the config's display order - ORDER BY on the value column follows
  // physical enum order, not display order. A PAYLOAD_DB_PUSH=true run may
  // propose recreating the type to realign physical order with config order.
  await payload.db.drizzle.execute(sql`
    ALTER TYPE "public"."enum_organization_staff_roles" ADD VALUE IF NOT EXISTS 'region-lead';
    ALTER TYPE "public"."enum_organization_staff_roles" ADD VALUE IF NOT EXISTS 'administration';
    ALTER TYPE "public"."enum_organization_staff_roles" ADD VALUE IF NOT EXISTS 'marketing';
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_organization_staff_regions" AS ENUM('na', 'emea', 'sa', 'oce', 'apac', 'sea');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "organization_staff_regions" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_organization_staff_regions",
      "id" serial PRIMARY KEY NOT NULL
    );
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "organization_staff_regions"
        ADD CONSTRAINT "organization_staff_regions_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."organization_staff"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "organization_staff_regions_order_idx" ON "organization_staff_regions" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "organization_staff_regions_parent_idx" ON "organization_staff_regions" USING btree ("parent_id");
  `)

  // Retire moderator role assignments (holders reported before apply - see plan).
  await payload.db.drizzle.execute(sql`
    DELETE FROM "organization_staff_roles" WHERE "value" = 'moderator';
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Enum values cannot be removed without recreating the type; they remain.
  // Deleted moderator role rows are not restorable.
  // WARNING: on prod this DROP TABLE destroys all region-lead region
  // assignments with no backup - confirm before running down() on prod.
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "organization_staff_regions";
    DROP TYPE IF EXISTS "public"."enum_organization_staff_regions";
  `)
}
