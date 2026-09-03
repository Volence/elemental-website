import type { Payload, CollectionConfig, Field } from 'payload'
import { sql } from 'drizzle-orm'
import { createAuditLog } from '@/utilities/auditLogger'

/**
 * Every column that can point at people.id. Adding a relationTo:'people' field anywhere
 * makes tests/int/identity-merge-coverage fail until BOTH lists below are updated.
 */
export const PEOPLE_FK_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'active_sessions', column: 'user_id' },
  { table: 'audit_logs', column: 'user_id' },
  { table: 'availability_calendars', column: 'created_by_id' },
  { table: 'discord_polls', column: 'created_by_id' },
  { table: 'error_logs', column: 'user_id' },
  { table: 'ignored_duplicates', column: 'person1_id' },
  { table: 'ignored_duplicates', column: 'person2_id' },
  { table: 'identity_claims', column: 'claimant_id' },
  { table: 'identity_claims', column: 'target_id' },
  { table: 'identity_claims', column: 'reviewer_id' },
  { table: 'invite_links', column: 'created_by_id' },
  { table: 'invite_links', column: 'used_by_id' },
  { table: 'invite_links', column: 'linked_person_id' },
  { table: 'matches', column: 'production_workflow_assigned_observer_id' },
  { table: 'matches', column: 'production_workflow_assigned_producer_id' },
  { table: 'matches_rels', column: 'people_id' },
  { table: 'caster_su', column: 'user_id' },
  { table: 'assigned_c', column: 'user_id' },
  { table: 'opponent_teams_current_roster', column: 'person_id' },
  { table: 'opponent_teams_previous_roster', column: 'person_id' },
  { table: 'organization_staff', column: 'person_id' },
  { table: 'production', column: 'person_id' },
  { table: 'people', column: 'pug_invited_by_id' },
  { table: 'people', column: 'merged_into_id' },
  { table: 'pug_leaderboard', column: 'player_id' },
  { table: 'pug_matches', column: 'confirmed_by_id' },
  { table: 'pug_matches', column: 'reported_by_id' },
  { table: 'pug_matches', column: 'dispute_resolution_resolved_by_id' },
  { table: 'pug_matches_team1_players', column: 'player_id' },
  { table: 'pug_matches_team2_players', column: 'player_id' },
  { table: 'recruitment_listings', column: 'created_by_id' },
  { table: 'recruitment_listings', column: 'filled_by_id' },
  { table: 'scout_reports', column: 'reported_by_id' },
  { table: 'scout_reports_roster_snapshot', column: 'person_id' },
  { table: 'social_posts', column: 'assigned_to_id' },
  { table: 'social_posts', column: 'approved_by_id' },
  { table: 'tasks', column: 'requested_by_id' },
  { table: 'tasks_rels', column: 'people_id' },
  { table: 'tasks_comments', column: 'author_id' },
  { table: 'teams', column: 'co_captain_id' },
  { table: 'teams_captain', column: 'person_id' },
  { table: 'teams_coaches', column: 'person_id' },
  { table: 'teams_manager', column: 'person_id' },
  { table: 'teams_roster', column: 'person_id' },
  { table: 'teams_subs', column: 'person_id' },
  { table: 'twitch_streamers', column: 'person_id' },
  { table: 'watched_threads', column: 'added_by_id' },
  { table: 'absences', column: 'person_id' },
  { table: 'admin_page_views', column: 'person_id' },
  { table: 'merge_suggestions', column: 'new_person_id' },
  { table: 'merge_suggestions', column: 'existing_person_id' },
  { table: 'payload_locked_documents_rels', column: 'people_id' },
  { table: 'payload_preferences_rels', column: 'people_id' },
]

export const PRISMA_FK_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'pug_lobby_players', column: '"userId"' },
  { table: 'pug_queue_entries', column: '"userId"' },
  { table: 'pug_lobby_spectators', column: '"personId"' },
  { table: 'pug_draft_states', column: '"captain1Id"' },
  { table: 'pug_draft_states', column: '"captain2Id"' },
  { table: 'pug_lobbies', column: '"hostUserId"' },
  { table: 'scrim_player_stats', column: '"personId"' },
]

/**
 * "<collection>.<field path>" -> "<table>.<column>" for every relationship to people in the
 * registered collections. Populate by running the coverage test once and pasting its `missing`
 * output (as keys), then filling in the matching table.column value using Payload naming
 * (top-level -> <table>.<field>_id, array/nested -> <table>_<array>.<field>_id, hasMany or
 * polymorphic -> <table>_rels.people_id). A dedicated test asserts every value here is present
 * in PEOPLE_FK_COLUMNS.
 */
export const COVERED_PEOPLE_FIELDS: Record<string, string> = {
  'people.pugInvitedBy': 'people.pug_invited_by_id',
  'people.mergedInto': 'people.merged_into_id',
  'identity-claims.claimant': 'identity_claims.claimant_id',
  'identity-claims.target': 'identity_claims.target_id',
  'identity-claims.reviewer': 'identity_claims.reviewer_id',
  'teams.manager.person': 'teams_manager.person_id',
  'teams.coaches.person': 'teams_coaches.person_id',
  'teams.captain.person': 'teams_captain.person_id',
  'teams.coCaptain': 'teams.co_captain_id',
  'teams.roster.person': 'teams_roster.person_id',
  'teams.subs.person': 'teams_subs.person_id',
  'organization-staff.person': 'organization_staff.person_id',
  'opponent-teams.currentRoster.person': 'opponent_teams_current_roster.person_id',
  'opponent-teams.previousRoster.person': 'opponent_teams_previous_roster.person_id',
  'scout-reports.reportedBy': 'scout_reports.reported_by_id',
  'scout-reports.rosterSnapshot.person': 'scout_reports_roster_snapshot.person_id',
  'matches.productionWorkflow.observerSignups': 'matches_rels.people_id',
  'matches.productionWorkflow.producerSignups': 'matches_rels.people_id',
  'matches.productionWorkflow.casterSignups.user': 'caster_su.user_id',
  'matches.productionWorkflow.assignedObserver': 'matches.production_workflow_assigned_observer_id',
  'matches.productionWorkflow.assignedProducer': 'matches.production_workflow_assigned_producer_id',
  'matches.productionWorkflow.assignedCasters.user': 'assigned_c.user_id',
  'pug-matches.team1Players.player': 'pug_matches_team1_players.player_id',
  'pug-matches.team2Players.player': 'pug_matches_team2_players.player_id',
  'pug-matches.reportedBy': 'pug_matches.reported_by_id',
  'pug-matches.confirmedBy': 'pug_matches.confirmed_by_id',
  'pug-matches.disputeResolution.resolvedBy': 'pug_matches.dispute_resolution_resolved_by_id',
  'pug-leaderboard.player': 'pug_leaderboard.player_id',
  'social-posts.assignedTo': 'social_posts.assigned_to_id',
  'social-posts.approvedBy': 'social_posts.approved_by_id',
  'production.person': 'production.person_id',
  'recruitment-listings.filledBy': 'recruitment_listings.filled_by_id',
  'recruitment-listings.createdBy': 'recruitment_listings.created_by_id',
  'discord-polls.createdBy': 'discord_polls.created_by_id',
  'availability-calendars.createdBy': 'availability_calendars.created_by_id',
  'absences.person': 'absences.person_id',
  'tasks.assignedTo': 'tasks_rels.people_id',
  'tasks.requestedBy': 'tasks.requested_by_id',
  'tasks.comments.author': 'tasks_comments.author_id',
  'watched-threads.addedBy': 'watched_threads.added_by_id',
  'twitch-streamers.person': 'twitch_streamers.person_id',
  'audit-logs.user': 'audit_logs.user_id',
  'error-logs.user': 'error_logs.user_id',
  'active-sessions.user': 'active_sessions.user_id',
  'admin-page-views.person': 'admin_page_views.person_id',
  'ignored-duplicates.person1': 'ignored_duplicates.person1_id',
  'ignored-duplicates.person2': 'ignored_duplicates.person2_id',
  'invite-links.linkedPerson': 'invite_links.linked_person_id',
  'invite-links.usedBy': 'invite_links.used_by_id',
  'invite-links.createdBy': 'invite_links.created_by_id',
  'payload-locked-documents.document': 'payload_locked_documents_rels.people_id',
  'payload-locked-documents.user': 'payload_locked_documents_rels.people_id',
  'payload-preferences.user': 'payload_preferences_rels.people_id',
}

function walk(fields: Field[], prefix: string, out: string[]): void {
  for (const f of fields as any[]) {
    if (f.type === 'tabs') {
      for (const tab of f.tabs) walk(tab.fields, tab.name ? `${prefix}${tab.name}.` : prefix, out)
      continue
    }
    if (f.type === 'row' || f.type === 'collapsible') {
      walk(f.fields, prefix, out)
      continue
    }
    if (f.type === 'group' || f.type === 'array') {
      walk(f.fields, `${prefix}${f.name}.`, out)
      continue
    }
    if (f.type === 'blocks') {
      for (const b of f.blocks) walk(b.fields, `${prefix}${f.name}.${b.slug}.`, out)
      continue
    }
    if ((f.type === 'relationship' || f.type === 'upload') && f.name) {
      const targets = Array.isArray(f.relationTo) ? f.relationTo : [f.relationTo]
      if (targets.includes('people')) out.push(`${prefix}${f.name}`)
    }
  }
}

export function collectPeopleRelationPaths(collections: CollectionConfig[]): string[] {
  const out: string[] = []
  for (const c of collections) {
    const local: string[] = []
    walk(c.fields, '', local)
    out.push(...local.map((p) => `${c.slug}.${p}`))
  }
  return out
}

const stripRowIds = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(stripRowIds) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value as any)) if (k !== 'id') out[k] = stripRowIds(v)
    return out as T
  }
  return value
}

const PROFILE_FIELDS = ['discordId', 'discordUsername', 'discordAvatar', 'email', 'bio', 'photo', 'avatar', 'socialLinks', 'gameAliases', 'showInLiveStreamers', 'pronouns', 'pronunciation']
const PUG_FIELDS = ['pugTiers', 'pugApprovedRoles', 'pugInviteRegions', 'pugBattleTag', 'pugRegisteredDate', 'pugBanOffenseCount', 'pugInvitedBy']
const ROLE_PRIORITY = ['admin', 'staff-manager', 'team-manager', 'player', 'user']

// A row's `id` column is either a Postgres integer or a Payload-generated varchar (hex) id.
// Render it as a safe SQL literal for interpolation into a raw statement.
function idLiteral(id: unknown): string {
  if (typeof id === 'number') return String(id)
  return `'${String(id).replace(/'/g, "''")}'`
}

// drizzle-orm's node-postgres driver wraps the raw pg error in a DrizzleQueryError whose own
// `.code`/`.message` don't carry the Postgres error code - that lives on `.cause`. Check both so
// unique-violation (23505) and undefined-table (42P01) detection works regardless of wrapping.
function pgErrorCode(e: any): string | undefined {
  return e?.code ?? e?.cause?.code
}
function pgErrorIsUnique(e: any): boolean {
  return pgErrorCode(e) === '23505' || Boolean(e?.message?.includes('unique')) || Boolean(e?.cause?.message?.includes('unique'))
}

/**
 * Repoint every row in `table.column` (or `quotedColumn`, already-quoted for Prisma-style
 * camelCase columns) from sourceId to targetId, inside transaction `tx`. Tries a single
 * set-based UPDATE first. If that trips a unique-constraint violation (a composite unique
 * spanning this column, e.g. identity_claims' (claimant_id, target_id)), a set-based UPDATE
 * would be all-or-nothing, and a blind `DELETE ... WHERE column = source` would destroy every
 * source row in the table, not just the colliding one. So on 23505 we fall back to repointing
 * row by row, wrapping each row in its own savepoint so a single collision only rolls back that
 * row's attempt (not the whole transaction) and lets us delete only the one truly-duplicate row.
 * Never deletes from `people` itself; a collision there is rethrown instead.
 */
export async function repointColumn(
  tx: any,
  table: string,
  column: string,
  quotedColumn: string,
  sourceId: number,
  targetId: number,
  log: string[],
): Promise<void> {
  // A failed statement poisons the rest of the transaction in Postgres unless it ran inside a
  // savepoint, so the initial set-based attempt needs one too, not just the per-row fallback -
  // otherwise the fallback's own SELECT would immediately fail with "transaction is aborted".
  await tx.execute(sql.raw(`SAVEPOINT sp_col`))
  try {
    await tx.execute(sql.raw(`UPDATE "${table}" SET ${quotedColumn} = ${targetId} WHERE ${quotedColumn} = ${sourceId}`))
    await tx.execute(sql.raw(`RELEASE SAVEPOINT sp_col`))
    log.push(`Repointed ${table}.${column}`)
  } catch (e: any) {
    await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT sp_col`))
    await tx.execute(sql.raw(`RELEASE SAVEPOINT sp_col`))
    if (pgErrorIsUnique(e)) {
      await repointColumnRowByRow(tx, table, column, quotedColumn, sourceId, targetId, log)
    } else if (pgErrorCode(e) === '42P01') {
      log.push(`Skipped ${table}.${column}: table missing`)
    } else {
      throw e
    }
  }
}

async function repointColumnRowByRow(
  tx: any,
  table: string,
  column: string,
  quotedColumn: string,
  sourceId: number,
  targetId: number,
  log: string[],
): Promise<void> {
  const result = await tx.execute(sql.raw(`SELECT id FROM "${table}" WHERE ${quotedColumn} = ${sourceId}`))
  const rows: any[] = (result as any).rows ?? result
  let repointed = 0
  let deduped = 0
  for (const row of rows) {
    const rowId = idLiteral(row.id)
    await tx.execute(sql.raw(`SAVEPOINT sp_row`))
    try {
      await tx.execute(sql.raw(`UPDATE "${table}" SET ${quotedColumn} = ${targetId} WHERE id = ${rowId}`))
      await tx.execute(sql.raw(`RELEASE SAVEPOINT sp_row`))
      repointed++
    } catch (e: any) {
      await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT sp_row`))
      await tx.execute(sql.raw(`RELEASE SAVEPOINT sp_row`))
      if (pgErrorIsUnique(e)) {
        if (table === 'people') throw e // never delete from people, even a single row
        await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE id = ${rowId}`))
        deduped++
      } else {
        throw e
      }
    }
  }
  if (repointed > 0) log.push(`Repointed ${table}.${column} (${repointed} row(s), per-row fallback)`)
  if (deduped > 0) log.push(`Deduplicated ${table}.${column} (${deduped} true duplicate row(s))`)
}

/**
 * Merge source into target. Target keeps its id. Nothing is deleted except the source's
 * sessions and junction rows that would duplicate ones the target already has.
 *
 * The field merge, the reference repointing, the archive and the pending-claim sweep all run
 * inside one Payload-managed transaction, so a failure anywhere leaves the source and target
 * exactly as they were.
 */
export async function mergePeople(
  payload: Payload,
  args: { targetId: number; sourceId: number; actorId: number | null; note?: string },
): Promise<{ log: string[] }> {
  const { targetId, sourceId, actorId } = args
  if (targetId === sourceId) throw new Error('Cannot merge a person into itself')
  const log: string[] = []

  const [t, s] = await Promise.all([
    payload.findByID({ collection: 'people', id: targetId, depth: 0, overrideAccess: true, showHiddenFields: true }) as Promise<any>,
    payload.findByID({ collection: 'people', id: sourceId, depth: 0, overrideAccess: true, showHiddenFields: true }) as Promise<any>,
  ])
  if (!t || !s) throw new Error('One or both people not found')
  if (t.mergedInto) throw new Error(`Target #${targetId} was already merged into #${t.mergedInto}`)
  if (s.mergedInto) throw new Error(`Source #${sourceId} was already merged into #${s.mergedInto}`)

  // 1. Field merge onto target (empty target fields take the source's value).
  const empty = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
  const data: Record<string, any> = {}
  const conflicts: string[] = []
  for (const f of PROFILE_FIELDS) if (empty(t[f]) && !empty(s[f])) data[f] = s[f]
  if (empty(t.pugRegisteredDate) && !empty(s.pugRegisteredDate)) {
    for (const f of PUG_FIELDS) if (!empty(s[f])) data[f] = s[f]
  } else if (!empty(s.pugRegisteredDate)) {
    conflicts.push('pug profile (kept target)')
  }
  const tTeams = (t.assignedTeams ?? []).map((x: any) => (typeof x === 'object' ? x.id : x))
  const sTeams = (s.assignedTeams ?? []).map((x: any) => (typeof x === 'object' ? x.id : x))
  const union = [...new Set([...tTeams, ...sTeams])]
  if (union.length > tTeams.length) data.assignedTeams = union
  if (ROLE_PRIORITY.indexOf(s.role ?? 'user') < ROLE_PRIORITY.indexOf(t.role ?? 'user')) data.role = s.role
  if (s.departments && Object.values(s.departments).some((v) => v === true)) {
    data.departments = { ...(t.departments ?? {}) }
    for (const [k, v] of Object.entries(s.departments)) if (v === true) data.departments[k] = true
  }
  // username follows discordId (Payload login identifier)
  if (data.discordId) data.username = data.discordId

  // The source's unique values that the target may take over. Recorded in the audit log so a
  // merge never drops an identifier without a trace of where it went.
  const sourceIdentity = {
    discordId: s.discordId ?? null,
    discordUsername: s.discordUsername ?? null,
    email: s.email ?? null,
    username: s.username ?? null,
  }

  // Everything below runs in one Payload-managed transaction: the field merge, the repointing,
  // the archive and the claim sweep either all land or none do. `tx` is the drizzle handle bound
  // to that transaction; `req` carries the same transaction into Payload's own operations.
  const db = (payload as any).db
  const tid = await db.beginTransaction()
  const req = { transactionID: tid } as any
  const tx = db.sessions?.[String(tid)]?.db ?? db.drizzle

  try {
    if (Object.keys(data).length > 0) {
      // The source must release the unique values the target is about to take (a unique index
      // covers discord_id, username and email). Only those - anything the target is not taking
      // stays on the archived row. discord_id/username go regardless: the archive step below
      // clears them anyway.
      const released = ['discord_id = NULL', 'username = NULL']
      if (data.email) released.push('email = NULL')
      await tx.execute(sql.raw(`UPDATE people SET ${released.join(', ')} WHERE id = ${sourceId}`))
      await payload.update({ collection: 'people', id: targetId, data: stripRowIds(data) as any, overrideAccess: true, req })
      log.push(`Merged fields into target: ${Object.keys(data).join(', ')}`)
    }

    for (const { table, column } of PEOPLE_FK_COLUMNS) {
      if (table === 'people' && column === 'merged_into_id') continue // handled below
      // Claims are history: a claim's claimant and target must keep pointing at the rows the
      // person actually filed it about. Repointing them would collapse a sibling claim's two
      // sides onto the same person and rewrite what was reviewed. Only reviewer_id moves.
      if (table === 'identity_claims' && (column === 'claimant_id' || column === 'target_id')) continue
      await repointColumn(tx, table, column, `"${column}"`, sourceId, targetId, log)
    }
    for (const { table, column } of PRISMA_FK_COLUMNS) {
      await repointColumn(tx, table, column, column, sourceId, targetId, log)
    }
    // Anyone previously merged into the source now points at the target.
    await tx.execute(sql`UPDATE people SET merged_into_id = ${targetId} WHERE merged_into_id = ${sourceId}`)
    // Archive the source. Never delete.
    await tx.execute(sql`UPDATE people SET is_inactive = true, merged_into_id = ${targetId}, discord_id = NULL, username = NULL WHERE id = ${sourceId}`)
    await tx.execute(sql`DELETE FROM people_sessions WHERE _parent_id = ${sourceId}`)
    log.push(`Archived source #${sourceId} (${s.name}) into #${targetId}`)
    // Any other claim still waiting on the archived row can never be acted on now.
    const declined = await tx.execute(sql`
      UPDATE identity_claims
      SET status = 'declined',
          note = COALESCE(note, '') || ${` superseded by merge into #${targetId}`},
          reviewed_at = now()
      WHERE status = 'pending' AND (claimant_id = ${sourceId} OR target_id = ${sourceId})
    `)
    const declinedCount = (declined as any)?.rowCount ?? (declined as any)?.rows?.length ?? 0
    if (declinedCount > 0) log.push(`Declined ${declinedCount} pending claim(s) superseded by the merge`)

    await db.commitTransaction(tid)
  } catch (err) {
    // Never let a rollback failure mask what actually went wrong.
    await db.rollbackTransaction(tid).catch((e: unknown) => console.error('[mergePeople] rollback failed:', e))
    throw err
  }

  const drizzle = db.drizzle
  try {
    await drizzle.execute(sql.raw(
      `UPDATE merge_suggestions SET status = 'merged', updated_at = now() WHERE status = 'pending' AND (new_person_id IN (${sourceId}, ${targetId}) OR existing_person_id IN (${sourceId}, ${targetId}))`,
    ))
  } catch {}

  try {
    await createAuditLog(payload, {
      user: actorId,
      action: 'update',
      collection: 'people',
      documentId: targetId,
      documentTitle: t.name,
      metadata: { identity: 'merge', sourceId, targetId, conflicts, sourceIdentity, note: args.note ?? null, log },
    })
  } catch (e) {
    console.error('[mergePeople] audit log failed:', e)
  }

  return { log }
}
