import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TYPE "enum_matches_status" ADD VALUE IF NOT EXISTS 'complete';
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  // Note: PostgreSQL does not support removing enum values
  // This is a one-way migration
  console.warn('Cannot remove enum value "complete" - this is a one-way migration')
}








