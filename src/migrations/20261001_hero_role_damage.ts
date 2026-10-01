import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The Heroes admin dropdown saved damage heroes as 'dps' while every seeded hero says 'damage',
 * so Shion landed in its own ban group and dodged the one-damage-ban limit. The dropdown now
 * saves 'damage'; this moves the stray rows over. It also renames the hand-made "Dmon" row to
 * Overwatch's spelling "D.Mon" - lobby settings paste hero names straight into the import, and
 * the game rejected "Dmon". Apply on prod by hand.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    UPDATE "heroes" SET "role" = 'damage' WHERE "role" = 'dps';
    UPDATE "heroes" SET "name" = 'D.Mon'
      WHERE "name" = 'Dmon' AND NOT EXISTS (SELECT 1 FROM "heroes" WHERE "name" = 'D.Mon');
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Data fix; nothing to undo.
}
