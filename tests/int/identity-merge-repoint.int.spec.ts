import { describe, it, expect } from 'vitest'
import { repointColumn, mergePeople, blockingReferences, removeMergedPerson } from '@/identity/merge'

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

  it('skips a missing column instead of failing the merge', async () => {
    // Prod can be a migration behind: the table is there but the FK column is not yet.
    const tx = {
      async execute(query: any) {
        const text = statementText(query)
        if (text.startsWith('UPDATE')) throw { cause: { code: '42703' } }
        return { rows: [] }
      },
    }
    const log: string[] = []
    await repointColumn(tx, 'availability_calendars', 'created_by_id', '"created_by_id"', SOURCE, TARGET, log)
    expect(log).toEqual(['Skipped availability_calendars.created_by_id: column missing'])
  })

  it('reports the real failure, not the savepoint, when the transaction is already gone', async () => {
    // 25P01: the statements are landing outside any transaction, so the savepoint dance fails
    // too. The savepoint error says nothing useful - the UPDATE's error is the story.
    const tx = {
      async execute(query: any) {
        const text = statementText(query)
        if (text.startsWith('UPDATE')) throw { cause: { code: '42703', message: 'column "created_by_id" does not exist' } }
        if (text.startsWith('ROLLBACK TO SAVEPOINT')) throw { cause: { code: '25P01' } }
        return { rows: [] }
      },
    }
    const log: string[] = []
    await expect(
      repointColumn(tx, 'availability_calendars', 'created_by_id', '"created_by_id"', SOURCE, TARGET, log),
    ).rejects.toThrow(/transaction .*no longer open.*column "created_by_id" does not exist/s)
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

/**
 * A payload double: one transaction session, every statement recorded.
 * `titles` is what `people_titles` holds for the source, and `targetTitles` which of them the
 * target already has (so the duplicate-check SELECT can answer).
 */
function fakePayload(
  people: Record<number, any>,
  titles: Array<{ id: string; title: string; is_lead: boolean; _order: number }> = [],
  targetTitles: string[] = [],
) {
  const statements: string[] = []
  const created: any[] = []
  const updated: any[] = []
  const events: string[] = []
  const tx = {
    async execute(query: any) {
      const text = statementText(query)
      statements.push(text)
      if (text.startsWith('SELECT id, title, is_lead, _order FROM people_titles')) return { rows: titles }
      if (text.startsWith('SELECT 1 FROM people_titles')) {
        const m = /title = '(.+)'$/.exec(text)
        return { rows: m && targetTitles.includes(m[1]) ? [{ '?column?': 1 }] : [] }
      }
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

  it('moves the source titles to the target and folds duplicates into the lead flag', async () => {
    const { payload, statements } = fakePayload(
      { 10: source, 20: target },
      [
        { id: 't1', title: 'caster', is_lead: true, _order: 1 },
        { id: 't2', title: 'graphics', is_lead: false, _order: 2 },
      ],
      ['caster'],
    )
    const { log } = await mergePeople(payload, { targetId: 20, sourceId: 10, actorId: null })

    expect(statements).toContain('SELECT id, title, is_lead, _order FROM people_titles WHERE _parent_id = 10')
    // Already held by the target: only the lead flag is folded in, the source row stays put.
    expect(statements).toContain("UPDATE people_titles SET is_lead = (COALESCE(is_lead, false) OR true) WHERE _parent_id = 20 AND title = 'caster'")
    expect(statements.some((s) => s.includes("_parent_id = 20") && s.includes("WHERE id = 't1'"))).toBe(false)
    // Not held by the target: the row itself moves, taking its regions with it.
    expect(statements).toContain(
      "UPDATE people_titles SET _parent_id = 20, _order = (SELECT COALESCE(MAX(_order), 0) + 1 FROM people_titles WHERE _parent_id = 20) WHERE id = 't2'",
    )
    expect(log).toContain('Moved 1 title(s) and folded 1 duplicate title(s) into #20')
    // The titles move before the source row is archived.
    const moveAt = statements.findIndex((s) => s.includes('UPDATE people_titles SET _parent_id = 20'))
    const archiveAt = statements.findIndex((s) => s.includes('is_inactive = true'))
    expect(moveAt).toBeGreaterThan(-1)
    expect(moveAt).toBeLessThan(archiveAt)
  })

  it('stops when a Payload hook silently rolled the transaction back', async () => {
    // Payload's killTransaction rolls our transaction back whenever an operation sharing the
    // merge's `req` fails - and a hook that swallows that error (the Twitch sync, the audit
    // logger) lets payload.update return as if nothing happened. Carrying on would run the
    // rest of the merge on a pooled connection, outside any transaction.
    const { payload, statements, events } = fakePayload({ 10: source, 20: target })
    const update = payload.update
    payload.update = async (args: any) => {
      delete payload.db.sessions['tx-1']
      return update(args)
    }
    await expect(mergePeople(payload, { targetId: 20, sourceId: 10, actorId: null })).rejects.toThrow(
      /transaction .*no longer open/i,
    )
    expect(events).toEqual(['begin', 'rollback'])
    // Nothing was repointed on a connection we no longer own.
    expect(statements.some((s) => s.startsWith('SAVEPOINT'))).toBe(false)
  })

  it('rolls the whole merge back when a statement fails', async () => {
    const { payload, events } = fakePayload({ 10: source, 20: target })
    payload.update = async () => { throw new Error('target update failed') }
    await expect(mergePeople(payload, { targetId: 20, sourceId: 10, actorId: null })).rejects.toThrow('target update failed')
    expect(events).toEqual(['begin', 'rollback'])
  })
})

/**
 * A transaction double for the catalog-driven reference scan: `fks` is what pg_constraint
 * reports, `counts` how many rows each table.column holds for the person being checked.
 */
function fakeCatalogTx(fks: Array<[string, string]>, counts: Record<string, number> = {}) {
  const statements: string[] = []
  return {
    statements,
    async execute(query: any) {
      const text = statementText(query)
      statements.push(text)
      if (text.includes('pg_constraint')) return { rows: fks.map(([tbl, col]) => ({ tbl, col })) }
      const m = /SELECT count\(\*\)[\s\S]*FROM "([^"]+)" WHERE "([^"]+)"/.exec(text)
      if (m) return { rows: [{ count: String(counts[`${m[1]}.${m[2]}`] ?? 0) }] }
      return { rows: [] }
    },
  }
}

describe('blockingReferences', () => {
  it('reads the live catalog, so a table no hand-written list knows about still blocks', async () => {
    // production is an unregistered legacy collection: it is in no FK list in this file, but it
    // has a NOT NULL person_id on production, which is exactly what stopped a delete.
    const tx = fakeCatalogTx(
      [['teams_roster', 'person_id'], ['production', 'person_id']],
      { 'production.person_id': 1 },
    )
    expect(await blockingReferences(tx, 10)).toEqual([{ table: 'production', column: 'person_id', count: 1 }])
  })

  it('ignores the row\'s own sub-tables and Payload\'s bookkeeping', async () => {
    const tx = fakeCatalogTx(
      [
        ['people_titles', '_parent_id'],
        ['people_rels', 'parent_id'],
        ['payload_locked_documents_rels', 'people_id'],
        ['payload_preferences_rels', 'people_id'],
      ],
      {
        'people_titles._parent_id': 3,
        'people_rels.parent_id': 2,
        'payload_locked_documents_rels.people_id': 1,
        'payload_preferences_rels.people_id': 1,
      },
    )
    expect(await blockingReferences(tx, 10)).toEqual([])
  })

  it('catches a column that carries no foreign key at all', async () => {
    // audit_logs.user_id and the teams_* family have no FK constraint in some databases, so the
    // catalog cannot see them. The merge's own list can.
    const tx = fakeCatalogTx([], { 'audit_logs.user_id': 4 })
    expect(await blockingReferences(tx, 10)).toEqual([{ table: 'audit_logs', column: 'user_id', count: 4 }])
  })

  it('skips a table or column this database has not got', async () => {
    const tx = {
      async execute(query: any) {
        const text = statementText(query)
        if (text.includes('pg_constraint')) return { rows: [] }
        throw { cause: { code: text.includes('teams_roster') ? '42703' : '42P01' } }
      },
    }
    expect(await blockingReferences(tx, 10)).toEqual([])
  })

  it('reports every table that still points at the row', async () => {
    const tx = fakeCatalogTx(
      [['teams_roster', 'person_id'], ['audit_logs', 'user_id'], ['tasks', 'requested_by_id']],
      { 'teams_roster.person_id': 2, 'audit_logs.user_id': 7 },
    )
    expect(await blockingReferences(tx, 10)).toEqual([
      { table: 'audit_logs', column: 'user_id', count: 7 },
      { table: 'teams_roster', column: 'person_id', count: 2 },
    ])
  })
})

describe('removeMergedPerson', () => {
  const merged = { id: 10, name: 'Old Volence', mergedInto: 20 }

  function removalPayload(person: any, fks: Array<[string, string]>, counts: Record<string, number> = {}) {
    const tx = fakeCatalogTx(fks, counts)
    const created: any[] = []
    const payload: any = {
      db: { drizzle: tx },
      async findByID({ id }: any) { return id === person?.id ? person : null },
      async create(args: any) { created.push(args); return { id: 1 } },
    }
    return { payload, tx, created }
  }

  it('refuses a person who was never merged away', async () => {
    const { payload, tx } = removalPayload({ id: 10, name: 'Volence', mergedInto: null }, [])
    await expect(removeMergedPerson(payload, { personId: 10, actorId: null })).rejects.toThrow(/was not merged/i)
    expect(tx.statements.some((s) => s.startsWith('DELETE'))).toBe(false)
  })

  it('refuses while anything still points at the row, and names what', async () => {
    const { payload, tx } = removalPayload(merged, [['production', 'person_id']], { 'production.person_id': 1 })
    await expect(removeMergedPerson(payload, { personId: 10, actorId: null })).rejects.toThrow(/production\.person_id \(1\)/)
    expect(tx.statements.some((s) => s.startsWith('DELETE'))).toBe(false)
  })

  it('deletes the row once nothing points at it, and records it', async () => {
    const { payload, tx, created } = removalPayload(merged, [['teams_roster', 'person_id']])
    await removeMergedPerson(payload, { personId: 10, actorId: 3 })
    expect(tx.statements).toContain('DELETE FROM people WHERE id = 10')
    expect(created[0].data.metadata).toMatchObject({ identity: 'remove-merged', personId: 10, mergedInto: 20 })
  })
})
