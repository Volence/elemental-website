import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

async function getAdmin() {
  const payload = await getPayload({ config: configPromise })
  const reqHeaders = await headers()
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || (user as any).role !== 'admin') return null
  return payload
}

export async function GET(request: NextRequest) {
  const payload = await getAdmin()
  if (!payload) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const url = new URL(request.url)
  const targetId = parseInt(url.searchParams.get('targetId') ?? '', 10)
  const sourceId = parseInt(url.searchParams.get('sourceId') ?? '', 10)
  if (!targetId || !sourceId || targetId === sourceId) {
    return NextResponse.json({ error: 'Two different person IDs required' }, { status: 400 })
  }

  const [target, source] = await Promise.all([
    payload.findByID({ collection: 'people', id: targetId, depth: 1, overrideAccess: true }),
    payload.findByID({ collection: 'people', id: sourceId, depth: 1, overrideAccess: true }),
  ])

  if (!target || !source) {
    return NextResponse.json({ error: 'One or both people not found' }, { status: 404 })
  }

  const t = target as any
  const s = source as any

  const fieldsToMerge: Array<{ field: string; targetValue: any; sourceValue: any; willCopy: boolean }> = []

  const checkField = (field: string, tVal: any, sVal: any) => {
    const tEmpty = tVal == null || tVal === '' || (Array.isArray(tVal) && tVal.length === 0)
    const sEmpty = sVal == null || sVal === '' || (Array.isArray(sVal) && sVal.length === 0)
    if (!sEmpty) {
      fieldsToMerge.push({ field, targetValue: tVal, sourceValue: sVal, willCopy: tEmpty })
    }
  }

  checkField('discordId', t.discordId, s.discordId)
  checkField('email', t.email, s.email)
  checkField('bio', t.bio, s.bio)
  checkField('photo', t.photo?.url ?? t.photo, s.photo?.url ?? s.photo)
  checkField('avatar', t.avatar?.url ?? t.avatar, s.avatar?.url ?? s.avatar)
  checkField('role', t.role, s.role)
  checkField('pugTiers', t.pugTiers, s.pugTiers)
  checkField('pugApprovedRoles', t.pugApprovedRoles, s.pugApprovedRoles)
  checkField('pugInviteRegions', t.pugInviteRegions, s.pugInviteRegions)
  checkField('pugBattleTag', t.pugBattleTag, s.pugBattleTag)
  checkField('pugRegisteredDate', t.pugRegisteredDate, s.pugRegisteredDate)
  checkField('pugBanOffenseCount', t.pugBanOffenseCount, s.pugBanOffenseCount)
  checkField('socialLinks', t.socialLinks, s.socialLinks)
  checkField('gameAliases', t.gameAliases, s.gameAliases)
  checkField('assignedTeams', t.assignedTeams, s.assignedTeams)
  checkField('showInLiveStreamers', t.showInLiveStreamers, s.showInLiveStreamers)

  // Find teams that reference either person
  const allTeams = await payload.find({
    collection: 'teams',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  type TeamRef = { teamId: number; teamName: string; roles: string[] }
  const findTeamRefs = (personId: number): TeamRef[] => {
    const refs: TeamRef[] = []
    for (const team of allTeams.docs) {
      const roles: string[] = []
      const checkArr = (arr: any[] | undefined, role: string) => {
        if (arr?.some((item: any) => {
          const pid = typeof item.person === 'object' ? item.person?.id : item.person
          return pid === personId
        })) roles.push(role)
      }
      checkArr(team.roster ?? undefined, 'Roster')
      checkArr(team.subs ?? undefined, 'Sub')
      checkArr(team.captain ?? undefined, 'Captain')
      checkArr(team.coaches ?? undefined, 'Coach')
      checkArr(team.manager ?? undefined, 'Manager')
      if ((typeof team.coCaptain === 'object' ? (team.coCaptain as any)?.id : team.coCaptain) === personId) {
        roles.push('Co-Captain')
      }
      if (roles.length > 0) {
        refs.push({ teamId: team.id, teamName: team.name, roles })
      }
    }
    return refs
  }

  const targetTeamRefs = findTeamRefs(targetId)
  const sourceTeamRefs = findTeamRefs(sourceId)

  return NextResponse.json({
    target: { id: t.id, name: t.name, email: t.email, discordId: t.discordId, role: t.role, photoUrl: t.photo?.url ?? null },
    source: { id: s.id, name: s.name, email: s.email, discordId: s.discordId, role: s.role, photoUrl: s.photo?.url ?? null },
    fieldsToMerge,
    targetTeamRefs,
    sourceTeamRefs,
  })
}

// All FK references to people across both Payload and Prisma tables
const FK_UPDATES: Array<{ table: string; column: string }> = [
  // Payload direct FKs
  { table: 'active_sessions', column: 'user_id' },
  { table: 'audit_logs', column: 'user_id' },
  { table: 'availability_calendars', column: 'created_by_id' },
  { table: 'discord_polls', column: 'created_by_id' },
  { table: 'error_logs', column: 'user_id' },
  { table: 'ignored_duplicates', column: 'person1_id' },
  { table: 'ignored_duplicates', column: 'person2_id' },
  { table: 'invite_links', column: 'created_by_id' },
  { table: 'invite_links', column: 'used_by_id' },
  { table: 'invite_links', column: 'linked_person_id' },
  { table: 'matches', column: 'production_workflow_assigned_observer_id' },
  { table: 'matches', column: 'production_workflow_assigned_producer_id' },
  { table: 'opponent_teams_current_roster', column: 'person_id' },
  { table: 'opponent_teams_previous_roster', column: 'person_id' },
  { table: 'organization_staff', column: 'person_id' },
  { table: 'production', column: 'person_id' },
  { table: 'recruitment_listings', column: 'created_by_id' },
  { table: 'recruitment_listings', column: 'filled_by_id' },
  { table: 'scout_reports', column: 'reported_by_id' },
  { table: 'scout_reports_roster_snapshot', column: 'person_id' },
  { table: 'social_posts', column: 'assigned_to_id' },
  { table: 'social_posts', column: 'approved_by_id' },
  { table: 'tasks', column: 'requested_by_id' },
  { table: 'teams', column: 'co_captain_id' },
  { table: 'teams_captain', column: 'person_id' },
  { table: 'teams_coaches', column: 'person_id' },
  { table: 'teams_manager', column: 'person_id' },
  { table: 'teams_roster', column: 'person_id' },
  { table: 'teams_subs', column: 'person_id' },
  { table: 'twitch_streamers', column: 'person_id' },
  { table: 'watched_threads', column: 'added_by_id' },
  { table: 'caster_su', column: 'user_id' },
  { table: 'assigned_c', column: 'user_id' },
  // Self-reference
  { table: 'people', column: 'pug_invited_by_id' },
  // Payload rels/junction tables
  { table: 'matches_rels', column: 'people_id' },
  { table: 'tasks_rels', column: 'people_id' },
  { table: 'payload_locked_documents_rels', column: 'people_id' },
  { table: 'payload_preferences_rels', column: 'people_id' },
  // PUG Payload tables
  { table: 'pug_matches', column: 'confirmed_by_id' },
  { table: 'pug_matches', column: 'reported_by_id' },
  { table: 'pug_matches', column: 'dispute_resolution_resolved_by_id' },
  { table: 'pug_matches_team1_players', column: 'player_id' },
  { table: 'pug_matches_team2_players', column: 'player_id' },
  { table: 'pug_leaderboard', column: 'player_id' },
]

// Prisma tables (different quoting - camelCase columns)
const PRISMA_UPDATES: Array<{ table: string; column: string }> = [
  { table: 'pug_lobby_players', column: '"userId"' },
  { table: 'pug_draft_states', column: '"captain1Id"' },
  { table: 'pug_draft_states', column: '"captain2Id"' },
  { table: 'pug_lobbies', column: '"hostUserId"' },
  { table: 'scrim_player_stats', column: '"personId"' },
]

export async function POST(request: NextRequest) {
  const payload = await getAdmin()
  if (!payload) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const body = await request.json()
  const targetId = parseInt(body.targetId, 10)
  const sourceId = parseInt(body.sourceId, 10)
  if (!targetId || !sourceId || targetId === sourceId) {
    return NextResponse.json({ error: 'Two different person IDs required' }, { status: 400 })
  }

  const [target, source] = await Promise.all([
    payload.findByID({ collection: 'people', id: targetId, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'people', id: sourceId, depth: 0, overrideAccess: true }),
  ])
  if (!target || !source) {
    return NextResponse.json({ error: 'One or both people not found' }, { status: 404 })
  }

  const t = target as any
  const s = source as any
  const mergeData: Record<string, any> = {}

  const mergeField = (field: string) => {
    const tVal = t[field]
    const sVal = s[field]
    const tEmpty = tVal == null || tVal === '' || (Array.isArray(tVal) && tVal.length === 0)
    const sEmpty = sVal == null || sVal === '' || (Array.isArray(sVal) && sVal.length === 0)
    if (tEmpty && !sEmpty) mergeData[field] = sVal
  }

  mergeField('discordId')
  mergeField('email')
  mergeField('bio')
  mergeField('photo')
  mergeField('avatar')
  mergeField('pugTiers')
  mergeField('pugApprovedRoles')
  mergeField('pugInviteRegions')
  mergeField('pugBattleTag')
  mergeField('pugRegisteredDate')
  mergeField('pugBanOffenseCount')
  mergeField('socialLinks')
  mergeField('gameAliases')
  mergeField('assignedTeams')
  mergeField('showInLiveStreamers')

  // Higher role wins (lower index = more powerful)
  const ROLE_PRIORITY = ['admin', 'staff-manager', 'team-manager', 'player', 'user']
  const tRoleIdx = ROLE_PRIORITY.indexOf(t.role ?? 'user')
  const sRoleIdx = ROLE_PRIORITY.indexOf(s.role ?? 'user')
  if (sRoleIdx >= 0 && sRoleIdx < tRoleIdx) {
    mergeData.role = s.role
  }

  // Merge departments (union of true flags)
  if (s.departments) {
    const merged = { ...(t.departments ?? {}) }
    for (const [k, v] of Object.entries(s.departments)) {
      if (v === true) merged[k] = true
    }
    mergeData.departments = merged
  }

  const db = (payload as any).db?.pool ?? (payload as any).db?.client
  const log: string[] = []

  try {
    // Step 1: Update target person with merged fields
    if (Object.keys(mergeData).length > 0) {
      await payload.update({
        collection: 'people',
        id: targetId,
        data: mergeData,
        overrideAccess: true,
      })
      log.push(`Merged fields into target: ${Object.keys(mergeData).join(', ')}`)
    }

    // Step 2: Repoint all FK references via raw SQL
    // Use Drizzle's raw SQL through Payload's DB adapter
    const drizzle = (payload as any).db?.drizzle
    if (!drizzle) {
      return NextResponse.json({ error: 'Cannot access database adapter' }, { status: 500 })
    }

    const { sql } = await import('drizzle-orm')

    for (const { table, column } of FK_UPDATES) {
      try {
        await drizzle.execute(sql.raw(
          `UPDATE "${table}" SET "${column}" = ${targetId} WHERE "${column}" = ${sourceId}`
        ))
        log.push(`Repointed ${table}.${column}`)
      } catch (e: any) {
        if (e.message?.includes('unique') || e.code === '23505') {
          await drizzle.execute(sql.raw(
            `DELETE FROM "${table}" WHERE "${column}" = ${sourceId}`
          ))
          log.push(`Deduplicated ${table}.${column}`)
        } else {
          log.push(`Skipped ${table}.${column}: ${e.message}`)
        }
      }
    }

    for (const { table, column } of PRISMA_UPDATES) {
      try {
        await drizzle.execute(sql.raw(
          `UPDATE "${table}" SET ${column} = ${targetId} WHERE ${column} = ${sourceId}`
        ))
        log.push(`Repointed ${table}.${column}`)
      } catch (e: any) {
        if (e.message?.includes('unique') || e.code === '23505') {
          await drizzle.execute(sql.raw(
            `DELETE FROM "${table}" WHERE ${column} = ${sourceId}`
          ))
          log.push(`Deduplicated ${table}.${column}`)
        } else {
          log.push(`Skipped ${table}.${column}: ${e.message}`)
        }
      }
    }

    // Step 2b: Handle pug_players (NOT NULL user_id with unique constraint)
    try {
      const pugPlayerCheck = await drizzle.execute(sql.raw(
        `SELECT id FROM pug_players WHERE user_id = ${sourceId}`
      ))
      const sourceHasPugPlayer = (pugPlayerCheck as any).rows?.length > 0

      if (sourceHasPugPlayer) {
        const targetCheck = await drizzle.execute(sql.raw(
          `SELECT id FROM pug_players WHERE user_id = ${targetId}`
        ))
        const targetHasPugPlayer = (targetCheck as any).rows?.length > 0

        if (targetHasPugPlayer) {
          const sourcePugId = (pugPlayerCheck as any).rows[0].id
          for (const childTable of ['pug_players_tiers', 'pug_players_approved_roles', 'pug_players_invite_regions']) {
            await drizzle.execute(sql.raw(`DELETE FROM "${childTable}" WHERE parent_id = ${sourcePugId}`))
          }
          await drizzle.execute(sql.raw(`DELETE FROM pug_players WHERE user_id = ${sourceId}`))
          log.push('Deleted duplicate pug_players entry (target already has one)')
        } else {
          await drizzle.execute(sql.raw(`UPDATE pug_players SET user_id = ${targetId} WHERE user_id = ${sourceId}`))
          log.push('Repointed pug_players.user_id')
        }
      }
    } catch (e: any) {
      log.push(`pug_players handling: ${e.message}`)
    }

    // Step 3: Delete source person
    await payload.delete({
      collection: 'people',
      id: sourceId,
      overrideAccess: true,
    })
    log.push(`Deleted source person #${sourceId} (${s.name})`)

    // Mark any related merge suggestions as merged
    try {
      const mergeResult = await drizzle.execute(sql.raw(
        `UPDATE merge_suggestions SET status = 'merged', updated_at = now() WHERE status = 'pending' AND (new_person_id IN (${sourceId}, ${targetId}) OR existing_person_id IN (${sourceId}, ${targetId}))`
      ))
      const resolved = (mergeResult as any).rowCount ?? 0
      if (resolved > 0) log.push(`Resolved ${resolved} merge suggestion(s)`)
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Merged "${s.name}" (#${sourceId}) into "${t.name}" (#${targetId})`,
      log,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, log }, { status: 500 })
  }
}
