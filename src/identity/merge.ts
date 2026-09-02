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
 * "<collection>.<field path>" for every relationship to people in the registered collections.
 * Populate by running the coverage test once and pasting its `missing` output, then verify each
 * path has a matching table.column above (Payload naming: top-level -> <table>.<field>_id,
 * array/nested -> <table>_<array>.<field>_id, hasMany or polymorphic -> <table>_rels.people_id).
 */
export const COVERED_PEOPLE_FIELDS: string[] = [
  'people.pugInvitedBy',
  'people.mergedInto',
  'identity-claims.claimant',
  'identity-claims.target',
  'identity-claims.reviewer',
  'teams.manager.person',
  'teams.coaches.person',
  'teams.captain.person',
  'teams.coCaptain',
  'teams.roster.person',
  'teams.subs.person',
  'organization-staff.person',
  'opponent-teams.currentRoster.person',
  'opponent-teams.previousRoster.person',
  'scout-reports.reportedBy',
  'scout-reports.rosterSnapshot.person',
  'matches.productionWorkflow.observerSignups',
  'matches.productionWorkflow.producerSignups',
  'matches.productionWorkflow.casterSignups.user',
  'matches.productionWorkflow.assignedObserver',
  'matches.productionWorkflow.assignedProducer',
  'matches.productionWorkflow.assignedCasters.user',
  'pug-matches.team1Players.player',
  'pug-matches.team2Players.player',
  'pug-matches.reportedBy',
  'pug-matches.confirmedBy',
  'pug-matches.disputeResolution.resolvedBy',
  'pug-leaderboard.player',
  'social-posts.assignedTo',
  'social-posts.approvedBy',
  'production.person',
  'recruitment-listings.filledBy',
  'recruitment-listings.createdBy',
  'discord-polls.createdBy',
  'availability-calendars.createdBy',
  'absences.person',
  'tasks.assignedTo',
  'tasks.requestedBy',
  'tasks.comments.author',
  'watched-threads.addedBy',
  'twitch-streamers.person',
  'audit-logs.user',
  'error-logs.user',
  'active-sessions.user',
  'ignored-duplicates.person1',
  'ignored-duplicates.person2',
  'invite-links.linkedPerson',
  'invite-links.usedBy',
  'invite-links.createdBy',
  'payload-locked-documents.document',
  'payload-locked-documents.user',
  'payload-preferences.user',
]

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

/**
 * Merge source into target. Target keeps its id. Nothing is deleted except the source's
 * sessions and junction rows that would duplicate ones the target already has.
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

  if (Object.keys(data).length > 0) {
    // The source must release unique values (discord_id, username, email) before the target takes them.
    const drizzle0 = (payload as any).db.drizzle
    await drizzle0.execute(sql`UPDATE people SET discord_id = NULL, username = NULL, email = NULL WHERE id = ${sourceId}`)
    await payload.update({ collection: 'people', id: targetId, data: stripRowIds(data) as any, overrideAccess: true })
    log.push(`Merged fields into target: ${Object.keys(data).join(', ')}`)
  }

  // 2. Repoint references and archive the source, in one transaction.
  const drizzle = (payload as any).db.drizzle
  await drizzle.transaction(async (tx: any) => {
    for (const { table, column } of PEOPLE_FK_COLUMNS) {
      if (table === 'people' && column === 'merged_into_id') continue // handled below
      try {
        await tx.execute(sql.raw(`UPDATE "${table}" SET "${column}" = ${targetId} WHERE "${column}" = ${sourceId}`))
        log.push(`Repointed ${table}.${column}`)
      } catch (e: any) {
        if (e.code === '23505' || e.message?.includes('unique')) {
          await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE "${column}" = ${sourceId}`))
          log.push(`Deduplicated ${table}.${column}`)
        } else if (e.code === '42P01') {
          log.push(`Skipped ${table}.${column}: table missing`)
        } else {
          throw e
        }
      }
    }
    for (const { table, column } of PRISMA_FK_COLUMNS) {
      try {
        await tx.execute(sql.raw(`UPDATE "${table}" SET ${column} = ${targetId} WHERE ${column} = ${sourceId}`))
        log.push(`Repointed ${table}.${column}`)
      } catch (e: any) {
        if (e.code === '23505' || e.message?.includes('unique')) {
          await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE ${column} = ${sourceId}`))
          log.push(`Deduplicated ${table}.${column}`)
        } else if (e.code === '42P01') {
          log.push(`Skipped ${table}.${column}: table missing`)
        } else {
          throw e
        }
      }
    }
    // Anyone previously merged into the source now points at the target.
    await tx.execute(sql`UPDATE people SET merged_into_id = ${targetId} WHERE merged_into_id = ${sourceId}`)
    // Archive the source. Never delete.
    await tx.execute(sql`UPDATE people SET is_inactive = true, merged_into_id = ${targetId}, discord_id = NULL, username = NULL WHERE id = ${sourceId}`)
    await tx.execute(sql`DELETE FROM people_sessions WHERE _parent_id = ${sourceId}`)
    log.push(`Archived source #${sourceId} (${s.name}) into #${targetId}`)
  })

  try {
    await drizzle.execute(sql.raw(
      `UPDATE merge_suggestions SET status = 'merged', updated_at = now() WHERE status = 'pending' AND (new_person_id IN (${sourceId}, ${targetId}) OR existing_person_id IN (${sourceId}, ${targetId}))`,
    ))
  } catch {}

  await createAuditLog(payload, {
    user: actorId,
    action: 'update',
    collection: 'people',
    documentId: targetId,
    documentTitle: t.name,
    metadata: { identity: 'merge', sourceId, targetId, conflicts, note: args.note ?? null, log },
  })

  return { log }
}
