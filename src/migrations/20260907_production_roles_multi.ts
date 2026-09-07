import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Production roles go multi (step 1 of 2, additive - safe to run BEFORE deploying).
 *
 * A match can now carry several observers, several producers and the new director role, so
 * assignedObserver/assignedProducer stop being columns on `matches` and become hasMany
 * relationships in `matches_rels`, where the signup lists already live.
 *
 * This migration only adds: the `director` title enum value, and a copy of every existing
 * assignment into matches_rels under the new paths. The old columns are left in place - the
 * running build keeps reading them, and paths it does not know are ignored - so this can be
 * applied ahead of the deploy and rolled back by redeploying the previous image.
 * Step 2 (20260907_production_roles_drop_columns) drops the columns once the deploy is verified.
 *
 * Re-runnable: the inserts skip rows already copied.
 */

const PAIRS: Array<{ column: string; path: string }> = [
  { column: 'production_workflow_assigned_observer_id', path: 'productionWorkflow.assignedObservers' },
  { column: 'production_workflow_assigned_producer_id', path: 'productionWorkflow.assignedProducers' },
]

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const db = payload.db.drizzle
  const log = (m: string) => payload.logger.info(`[production-roles] ${m}`)

  // 'director' joins the production titles. Adding the value is safe on its own; nothing reads
  // it until the new build ships.
  await db.execute(sql`ALTER TYPE "public"."enum_people_titles_title" ADD VALUE IF NOT EXISTS 'director'`)
  log("title enum now includes 'director'")

  for (const { column, path } of PAIRS) {
    const res: any = await db.execute(
      sql.raw(`
        INSERT INTO matches_rels ("order", parent_id, path, people_id)
        SELECT 1, m.id, '${path}', m."${column}"
        FROM matches m
        WHERE m."${column}" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM matches_rels r
            WHERE r.parent_id = m.id AND r.path = '${path}' AND r.people_id = m."${column}"
          )
      `),
    )
    log(`copied ${res.rowCount ?? 0} row(s) from ${column} to ${path}`)
  }
}

export async function down({ payload }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  // Removes only the copies; the source columns were never touched. Enum values cannot be
  // dropped in Postgres, so 'director' stays - harmless, nothing references it.
  const db = payload.db.drizzle
  for (const { path } of PAIRS) {
    await db.execute(sql.raw(`DELETE FROM matches_rels WHERE path = '${path}'`))
  }
}
