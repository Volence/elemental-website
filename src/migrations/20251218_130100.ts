import { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres"
import { sql } from "drizzle-orm"

/**
 * Migration: Add title_cell column to matches table
 * This column is used by the custom TitleCell component to display match titles in the list view
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE matches 
    ADD COLUMN IF NOT EXISTS title_cell VARCHAR;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE matches 
    DROP COLUMN IF EXISTS title_cell;
  `)
}
