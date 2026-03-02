import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Copy themeColor to brandingPrimary for teams that have themeColor but no brandingPrimary
  await db.execute(`
    UPDATE teams 
    SET branding_primary = theme_color 
    WHERE theme_color IS NOT NULL 
      AND theme_color != '' 
      AND (branding_primary IS NULL OR branding_primary = '');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // No rollback needed - themeColor column is preserved
}
