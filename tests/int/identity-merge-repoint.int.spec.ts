import { describe, it, expect } from 'vitest'
import { repointColumn, mergePeople } from '@/identity/merge'

const SOURCE = 10
const TARGET = 20

// drizzle sql`` and sql.raw() objects both expose queryChunks; stringify for assertions.
function statementText(query: any): string {
  if (!query?.queryChunks) return String(query)
  return query.queryChunks.map((c: any) => (typeof c === 'string' ? c : c?.value?.join?.('') ?? '?')).join('')
}

/**
 * A transaction that behaves like Postgres hitting a composite unique constraint: the set-based
 * UPDATE fails with 23505, the per-row retry fails for row 2 only.
 */
function fakeTx() {
  const statements: string[] = []
  return {
    statements,
    async execute(query: any) {
      const text = statementText(query)
      statements.push(text)
      if (text.startsWith('SELECT id FROM')) return { rows: [{ id: 1 }, { id: 2 }] }
      if (text.startsWith('UPDATE')) {
        const perRow = /WHERE id = (\d+)$/.exec(text)
        if (!perRow) throw { cause: { code: '23505' } } // the set-based attempt
        if (perRow[1] === '2') throw { cause: { code: '23505' } } // row 2 collides with the target's row
      }
      return { rows: [] }
    },
  }
}

describe('repointColumn', () => {
  it('falls back row by row inside savepoints and deletes only the truly duplicate row', async () => {
    const tx = fakeTx()
    const log: string[] = []
    await repointColumn(tx, 'teams_roster', 'person_id', '"person_id"', SOURCE, TARGET, log)

    expect(tx.statements).toEqual([
      'SAVEPOINT sp_col',
      `UPDATE "teams_roster" SET "person_id" = ${TARGET} WHERE "person_id" = ${SOURCE}`,
      'ROLLBACK TO SAVEPOINT sp_col',
      'RELEASE SAVEPOINT sp_col',
      `SELECT id FROM "teams_roster" WHERE "person_id" = ${SOURCE}`,
      'SAVEPOINT sp_row',
      `UPDATE "teams_roster" SET "person_id" = ${TARGET} WHERE id = 1`,
      'RELEASE SAVEPOINT sp_row',
      'SAVEPOINT sp_row',
      `UPDATE "teams_roster" SET "person_id" = ${TARGET} WHERE id = 2`,
      'ROLLBACK TO SAVEPOINT sp_row',
      'RELEASE SAVEPOINT sp_row',
      'DELETE FROM "teams_roster" WHERE id = 2',
    ])

    // Every row is attempted, and only the colliding one is deleted.
    expect(tx.statements.filter((s) => s.includes('WHERE id = 1'))).toEqual([
      `UPDATE "teams_roster" SET "person_id" = ${TARGET} WHERE id = 1`,
    ])
    expect(tx.statements.filter((s) => s.startsWith('DELETE'))).toEqual(['DELETE FROM "teams_roster" WHERE id = 2'])
    expect(log).toEqual([
      'Repointed teams_roster.person_id (1 row(s), per-row fallback)',
      'Deduplicated teams_roster.person_id (1 true duplicate row(s))',
    ])
  })

  it('rethrows instead of deleting when the collision is in people itself', async () => {
    const tx = fakeTx()
    const log: string[] = []
    await expect(repointColumn(tx, 'people', 'pug_invited_by_id', '"pug_invited_by_id"', SOURCE, TARGET, log)).rejects.toMatchObject({
      cause: { code: '23505' },
    })
    expect(tx.statements.some((s) => s.startsWith('DELETE'))).toBe(false)
  })

  it('takes the set-based path and logs once when nothing collides', async () => {
    const statements: string[] = []
    const tx = {
      async execute(query: any) {
        statements.push(statementText(query))
        return { rows: [] }
      },
    }
    const log: string[] = []
    await repointColumn(tx, 'tasks_rels', 'people_id', '"people_id"', SOURCE, TARGET, log)
    expect(statements).toEqual([
      'SAVEPOINT sp_col',
      `UPDATE "tasks_rels" SET "people_id" = ${TARGET} WHERE "people_id" = ${SOURCE}`,
      'RELEASE SAVEPOINT sp_col',
    ])
    expect(log).toEqual(['Repointed tasks_rels.people_id'])
  })

  it('skips a missing table instead of failing the merge', async () => {
    const tx = {
      async execute(query: any) {
        const text = statementText(query)
        if (text.startsWith('UPDATE')) throw { cause: { code: '42P01' } }
        return { rows: [] }
      },
    }
    const log: string[] = []
    await repointColumn(tx, 'scrim_player_stats', '"personId"', '"personId"', SOURCE, TARGET, log)
    expect(log).toEqual(['Skipped scrim_player_stats."personId": table missing'])
  })
})

/** A payload double: one transaction session, every statement recorded. */
function fakePayload(people: Record<number, any>) {
  const statements: string[] = []
  const created: any[] = []
  const updated: any[] = []
  const events: string[] = []
  const tx = {
    async execute(query: any) {
      const text = statementText(query)
      statements.push(text)
      if (text.startsWith('SELECT id FROM')) return { rows: [] }
      if (text.includes('identity_claims') && text.includes("status = 'declined'")) return { rows: [], rowCount: 2 }
      return { rows: [], rowCount: 0 }
    },
  }
  const payload: any = {
    db: {
      drizzle: tx,
      sessions: { 'tx-1': { db: tx } },
      async beginTransaction() { events.push('begin'); return 'tx-1' },
      async commitTransaction() { events.push('commit') },
      async rollbackTransaction() { events.push('rollback') },
    },
    async findByID({ id }: any) { return people[id] ?? null },
    async update(args: any) { updated.push(args); return people[args.id] },
    async create(args: any) { created.push(args); return { id: 1 } },
  }
  return { payload, statements, created, updated, events }
}

describe('mergePeople', () => {
  const target = { id: 20, name: 'Legacy Volence', email: 'vol@example.com', username: null, discordId: null }
  const source = { id: 10, name: 'Volence', email: null, username: '111111111111111111', discordId: '111111111111111111', discordUsername: 'volence' }

  it('never repoints a claim claimant/target, declines superseded claims, and records the source identity', async () => {
    const { payload, statements, created, updated, events } = fakePayload({ 10: source, 20: target })
    const { log } = await mergePeople(payload, { targetId: 20, sourceId: 10, actorId: 3, note: 'identity claim #5' })

    // Claim history keeps pointing at the rows the claim was filed about.
    expect(statements.filter((s) => s.includes('"claimant_id" ='))).toEqual([])
    expect(statements.filter((s) => s.includes('"target_id" ='))).toEqual([])
    // The reviewer, which is not history about who the claim was for, still moves.
    expect(statements.some((s) => s.includes('UPDATE "identity_claims" SET "reviewer_id" = 20'))).toBe(true)

    // Pending claims on the archived row are declined in the same transaction.
    const decline = statements.find((s) => s.includes('identity_claims') && s.includes("status = 'declined'"))
    expect(decline).toBeDefined()
    expect(decline).toContain("status = 'pending'")
    expect(log).toContain('Declined 2 pending claim(s) superseded by the merge')

    // One transaction around the whole merge, committed once.
    expect(events).toEqual(['begin', 'commit'])
    expect(updated[0].req.transactionID).toBe('tx-1')

    // The source's discord identity moved to the target, so it is nulled there and recorded.
    expect(statements.some((s) => s === 'UPDATE people SET discord_id = NULL, username = NULL WHERE id = 10')).toBe(true)
    expect(created[0].data.metadata.sourceIdentity).toEqual({
      discordId: '111111111111111111',
      discordUsername: 'volence',
      email: null,
      username: '111111111111111111',
    })
  })

  it('rolls the whole merge back when a statement fails', async () => {
    const { payload, events } = fakePayload({ 10: source, 20: target })
    payload.update = async () => { throw new Error('target update failed') }
    await expect(mergePeople(payload, { targetId: 20, sourceId: 10, actorId: null })).rejects.toThrow('target update failed')
    expect(events).toEqual(['begin', 'rollback'])
  })
})
