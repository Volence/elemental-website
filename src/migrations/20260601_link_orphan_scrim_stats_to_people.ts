import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Some scrim_player_stats rows carry a player_name that exactly matches an
// existing person's name but were never linked (personId IS NULL). Because the
// leaderboard keys on COALESCE(personId, player_name), the same human shows up
// as two rows - one personId-linked, one name-only - so they appear twice.
//
// Each name below resolves to exactly one person, and every already-linked row
// under that same name points to that same person, so completing the linkage is
// unambiguous. Guarded by "personId" IS NULL, so re-running is a no-op.
const LINKS: Array<{ name: string; personId: number }> = [
  { name: 'Dreamer', personId: 472 },
  { name: 'Geomaster53', personId: 234 },
  { name: 'Luxth', personId: 557 },
  { name: 'Salt', personId: 245 },
  { name: 'Soda', personId: 558 },
  { name: 'Traestaree', personId: 445 },
]

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  for (const { name, personId } of LINKS) {
    await payload.db.drizzle.execute(sql`
      UPDATE "scrim_player_stats"
      SET "personId" = ${personId}
      WHERE "player_name" = ${name}
        AND "personId" IS NULL
    `)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Forward-only data correction: once the orphan rows are linked they are
  // indistinguishable from the rows that were already linked to the same person,
  // so there is no pre-image to restore. Reverting would also null out the
  // originally-linked rows, which would be data loss. Intentional no-op.
}
