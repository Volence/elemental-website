import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Report only. Lists Discord IDs held by more than one people row so they can be merged on
 * /admin/identity before the unique index (20260903_identity_discord_id_unique) is created.
 * Safe to run any number of times. Also usable as plain SQL in psql.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const res: any = await payload.db.drizzle.execute(sql`
    SELECT discord_id, array_agg(id ORDER BY id) AS ids, array_agg(name ORDER BY id) AS names
    FROM people
    WHERE discord_id IS NOT NULL
    GROUP BY discord_id
    HAVING count(*) > 1
  `)
  const rows = res.rows ?? res
  if (rows.length === 0) {
    payload.logger.info('[identity] no duplicate discord_id values')
    return
  }
  for (const r of rows) payload.logger.warn(`[identity] duplicate discord_id ${r.discord_id}: ids=${r.ids} names=${r.names}`)
  payload.logger.warn(`[identity] ${rows.length} duplicate discord_id group(s). Merge them on /admin/identity before running 20260903_identity_discord_id_unique.`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // report only
}
