import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "departments_is_pug_admin" boolean DEFAULT false;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "users"
      DROP COLUMN IF EXISTS "departments_is_pug_admin";
  `)
}
