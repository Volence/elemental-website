import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Titles and access, migration C (archive). Run only after the titles build is live and /staff,
 * Discord staff cards, and the person editor have been checked. Renames, never drops.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE IF EXISTS "organization_staff_regions" RENAME TO "_organization_staff_regions_archived";
    ALTER TABLE IF EXISTS "organization_staff_roles" RENAME TO "_organization_staff_roles_archived";
    ALTER TABLE IF EXISTS "organization_staff" RENAME TO "_organization_staff_archived";
    ALTER TABLE IF EXISTS "production" RENAME TO "_production_archived";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "organization_staff_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "production_id";
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE IF EXISTS "_production_archived" RENAME TO "production";
    ALTER TABLE IF EXISTS "_organization_staff_archived" RENAME TO "organization_staff";
    ALTER TABLE IF EXISTS "_organization_staff_roles_archived" RENAME TO "organization_staff_roles";
    ALTER TABLE IF EXISTS "_organization_staff_regions_archived" RENAME TO "organization_staff_regions";
  `)
}
