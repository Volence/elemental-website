import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Production roles go multi (step 2 of 2, destructive - run AFTER the deploy is verified).
 *
 * Drops the single-assignment columns now that 20260907_production_roles_multi has copied
 * them into matches_rels and the deployed build reads the lists. Keeping them until the
 * deploy is confirmed is what makes step 1 reversible by redeploy alone.
 *
 * `down` recreates the columns and refills them from the first person in each list, which is
 * lossless for any match that still has one person per role and keeps the earliest assignment
 * otherwise.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "matches" DROP COLUMN IF EXISTS "production_workflow_assigned_observer_id";
    ALTER TABLE "matches" DROP COLUMN IF EXISTS "production_workflow_assigned_producer_id";
  `)
  payload.logger.info('[production-roles] dropped the single observer/producer columns')
}

export async function down({ payload }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  const db = payload.db.drizzle
  await db.execute(sql`
    ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "production_workflow_assigned_observer_id" integer;
    ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "production_workflow_assigned_producer_id" integer;
  `)
  for (const [column, path] of [
    ['production_workflow_assigned_observer_id', 'productionWorkflow.assignedObservers'],
    ['production_workflow_assigned_producer_id', 'productionWorkflow.assignedProducers'],
  ]) {
    await db.execute(
      sql.raw(`
        UPDATE matches m SET "${column}" = (
          SELECT r.people_id FROM matches_rels r
          WHERE r.parent_id = m.id AND r.path = '${path}' AND r.people_id IS NOT NULL
          ORDER BY r."order", r.id LIMIT 1
        )
      `),
    )
  }
}
