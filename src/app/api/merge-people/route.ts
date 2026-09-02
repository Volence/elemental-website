import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { mergePeople } from '@/identity/merge'

async function getAdmin() {
  const payload = await getPayload({ config: configPromise })
  const reqHeaders = await headers()
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || (user as any).role !== 'admin') return null
  return payload
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAdmin()
    if (!payload) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

    const url = new URL(request.url)
    const targetId = parseInt(url.searchParams.get('targetId') ?? '', 10)
    const sourceId = parseInt(url.searchParams.get('sourceId') ?? '', 10)
    if (!targetId || !sourceId || targetId === sourceId) {
      return NextResponse.json({ error: 'Two different person IDs required' }, { status: 400 })
    }

    let target: any, source: any
    try {
      ;[target, source] = await Promise.all([
        payload.findByID({ collection: 'people', id: targetId, depth: 1, overrideAccess: true }),
        payload.findByID({ collection: 'people', id: sourceId, depth: 1, overrideAccess: true }),
      ])
    } catch (findErr: any) {
      return NextResponse.json({ error: `Failed to look up people: ${findErr.message}` }, { status: 404 })
    }

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
    checkField('hash', t.hash ? '(set)' : null, s.hash ? '(set)' : null)
    checkField('salt', t.salt ? '(set)' : null, s.salt ? '(set)' : null)
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
    checkField('showInLiveStreamers', t.showInLiveStreamers, s.showInLiveStreamers)

    // assignedTeams: show union preview
    const tTeamIds = (t.assignedTeams || []).map((x: any) => typeof x === 'object' ? x.id : x)
    const sTeamIds = (s.assignedTeams || []).map((x: any) => typeof x === 'object' ? x.id : x)
    const newTeams = sTeamIds.filter((id: number) => !tTeamIds.includes(id))
    if (newTeams.length > 0) {
      fieldsToMerge.push({ field: 'assignedTeams', targetValue: t.assignedTeams, sourceValue: s.assignedTeams, willCopy: true })
    }

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
  } catch (err: any) {
    console.error('[Merge People] GET error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getAdmin()
  if (!payload) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  const reqHeaders = await headers()
  const { user } = await payload.auth({ headers: reqHeaders })

  const body = await request.json().catch(() => ({}))
  const targetId = parseInt(body.targetId, 10)
  const sourceId = parseInt(body.sourceId, 10)
  if (!targetId || !sourceId || targetId === sourceId) {
    return NextResponse.json({ error: 'Two different person IDs required' }, { status: 400 })
  }
  try {
    const { log } = await mergePeople(payload, { targetId, sourceId, actorId: (user?.id as number) ?? null, note: body.note })
    return NextResponse.json({ success: true, message: `Merged #${sourceId} into #${targetId}`, log })
  } catch (err: any) {
    console.error('[Merge People] POST error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
