import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function getDiscordIdentity(request: NextRequest, payload: any) {
  const payloadToken = request.cookies.get('payload-token')?.value
  if (!payloadToken) return null
  try {
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${payloadToken}` }) })
    if (!user) return null
    const role = (user as any).role || ''
    const isSiteAdmin = role === 'admin' || role === 'staff-manager' || role === 'team-manager'
    if ((user as any).discordId) {
      return {
        id: (user as any).discordId,
        username: (user as any).name || (user as any).email,
        avatar: null,
        isSiteAdmin,
      }
    }
    if (isSiteAdmin) {
      return {
        id: `payload-${(user as any).id}`,
        username: (user as any).name || (user as any).email,
        avatar: null,
        isSiteAdmin,
      }
    }
  } catch {}
  return null
}

async function isUserManager(team: any, discordId: string): Promise<boolean> {
  const staffArrays = [team.manager || [], team.coaches || [], team.captain || []]
  for (const staffArray of staffArrays) {
    for (const entry of staffArray) {
      const person = typeof entry === 'object' ? entry : null
      if (person && person.discordId === discordId) return true
    }
  }
  if (team.coCaptain) {
    const coCaptain = typeof team.coCaptain === 'object' ? team.coCaptain : null
    if (coCaptain && coCaptain.discordId === discordId) return true
  }
  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'team-slug': string }> }
) {
  const { 'team-slug': teamSlug } = await params

  try {
    const payload = await getPayload({ config: configPromise })

    const teamResult = await payload.find({
      collection: 'teams',
      where: {
        and: [
          { slug: { equals: teamSlug } },
          { active: { equals: true } },
        ],
      },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (teamResult.docs.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const team = teamResult.docs[0] as any

    // Find active calendar scoped to current week
    const now = new Date()
    const dow = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((dow + 6) % 7))
    mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const monStr = mon.toISOString().split('T')[0]
    const sunStr = sun.toISOString().split('T')[0]

    const calendarResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
          { 'dateRange.start': { less_than_equal: sunStr } },
          { 'dateRange.end': { greater_than_equal: monStr } },
        ],
      },
      limit: 1,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })

    const activeCalendar = calendarResult.docs[0] || null

    // Check for next week's calendar (created on Friday+)
    const nextMon = new Date(mon)
    nextMon.setDate(mon.getDate() + 7)
    const nextSun = new Date(nextMon)
    nextSun.setDate(nextMon.getDate() + 6)
    const nextMonStr = nextMon.toISOString().split('T')[0]
    const nextSunStr = nextSun.toISOString().split('T')[0]

    const nextWeekResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
          { 'dateRange.start': { less_than_equal: nextSunStr } },
          { 'dateRange.end': { greater_than_equal: nextMonStr } },
        ],
      },
      limit: 1,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })

    const nextWeekCalendar = nextWeekResult.docs[0] || null

    const recentResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { 'dateRange.start': { exists: true } },
        ],
      },
      limit: 52,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })

    const today = new Date().toISOString().split('T')[0]
    const absenceResult = await payload.find({
      collection: 'absences',
      where: {
        and: [
          { team: { equals: team.id } },
          { endDate: { greater_than_equal: today } },
        ],
      },
      limit: 100,
      depth: 1,
      sort: 'startDate',
    })

    const discordUser = await getDiscordIdentity(request, payload)
    let isManager = false
    let isOnRoster = false
    let playerId: string | undefined

    if (discordUser) {
      const roster = team.roster || []
      const subs = team.subs || []
      const allRosterMembers = [...roster, ...subs]

      for (const entry of allRosterMembers) {
        const person = typeof entry.person === 'object' ? entry.person : null
        if (person && person.discordId === discordUser.id) {
          isOnRoster = true
          playerId = String(person.id)
          break
        }
      }

      const staffArrays = [
        team.manager || [],
        team.coaches || [],
        team.captain || [],
      ]
      for (const staffArray of staffArrays) {
        for (const entry of staffArray) {
          const person = typeof entry === 'object' ? entry : null
          if (person && person.discordId === discordUser.id) {
            isManager = true
            break
          }
        }
        if (isManager) break
      }

      if (!isManager && team.coCaptain) {
        const coCaptain = typeof team.coCaptain === 'object' ? team.coCaptain : null
        if (coCaptain && coCaptain.discordId === discordUser.id) {
          isManager = true
        }
      }

      if (!isManager && discordUser.isSiteAdmin) {
        isManager = true
      }
    }

    const roster = (team.roster || []).map((entry: any) => ({
      person: typeof entry.person === 'object' ? {
        id: entry.person.id,
        name: entry.person.name,
        discordId: entry.person.discordId,
        discordAvatar: entry.person.discordAvatar,
      } : null,
      role: entry.role,
    })).filter((e: any) => e.person)

    const subsData = (team.subs || []).map((entry: any) => ({
      person: typeof entry.person === 'object' ? {
        id: entry.person.id,
        name: entry.person.name,
        discordId: entry.person.discordId,
        discordAvatar: entry.person.discordAvatar,
      } : null,
      role: entry.role,
    })).filter((e: any) => e.person)

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        roster,
        subs: subsData,
        scheduleBlocks: team.scheduleBlocks || [],
        scheduleTimezone: team.scheduleTimezone || 'America/New_York',
        rolePreset: team.rolePreset || 'specific',
        customRoles: team.customRoles,
        discordThreads: team.discordThreads || {},
      },
      activeCalendar,
      nextWeekCalendar,
      recentSchedules: recentResult.docs,
      absences: absenceResult.docs,
      authState: {
        isAuthenticated: !!discordUser,
        discordUser: discordUser ? {
          id: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
        } : undefined,
        isManager,
        isOnRoster,
        playerId,
      },
    })
  } catch (err) {
    console.error('[Schedule API] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch schedule data' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ 'team-slug': string }> }
) {
  const { 'team-slug': teamSlug } = await params

  try {
    const payload = await getPayload({ config: configPromise })
    const body = await request.json()

    const discordUser = await getDiscordIdentity(request, payload)
    if (!discordUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const teamResult = await payload.find({
      collection: 'teams',
      where: { slug: { equals: teamSlug } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    const team = teamResult.docs[0] as any
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isManagerUser = discordUser.isSiteAdmin || (await isUserManager(team, discordUser.id))

    if (body.action === 'saveSchedule') {
      if (!isManagerUser) {
        return NextResponse.json({ error: 'Only managers can save schedules' }, { status: 403 })
      }

      const { calendarId, schedule } = body
      if (!calendarId || !schedule) {
        return NextResponse.json({ error: 'Missing calendarId or schedule' }, { status: 400 })
      }

      const calendarDoc = await payload.findByID({
        collection: 'discord-polls' as any,
        id: calendarId,
        depth: 0,
        overrideAccess: true,
      })
      const responses = (calendarDoc as any).responses || []
      const responseSnapshot: Record<string, Record<string, Record<string, string>>> = {}
      for (const r of responses) {
        if (r.discordId && r.selections) {
          responseSnapshot[r.discordId] = r.selections
        }
      }

      await payload.update({
        collection: 'discord-polls' as any,
        id: calendarId,
        data: { schedule: { ...schedule, responseSnapshot } },
        overrideAccess: true,
      })

      return NextResponse.json({ success: true })
    }

    if (body.action !== 'updateRole') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const { discordId, scheduleRole, scheduleStatus, calendarId } = body
    const isSelf = discordUser.id === discordId
    if (!isSelf && !isManagerUser) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (scheduleStatus !== undefined && !isManagerUser) {
      return NextResponse.json({ error: 'Only managers can set player status' }, { status: 403 })
    }

    let calendar: any = null
    if (calendarId) {
      calendar = await payload.findByID({
        collection: 'discord-polls' as any,
        id: calendarId,
        depth: 0,
        overrideAccess: true,
      })
    } else {
      const now = new Date()
      const dow = now.getDay()
      const mon = new Date(now)
      mon.setDate(now.getDate() - ((dow + 6) % 7))
      mon.setHours(0, 0, 0, 0)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const monStr = mon.toISOString().split('T')[0]
      const sunStr = sun.toISOString().split('T')[0]

      const calendarResult = await payload.find({
        collection: 'discord-polls' as any,
        where: {
          and: [
            { team: { equals: team.id } },
            { scheduleType: { equals: 'calendar' } },
            { status: { equals: 'active' } },
            { 'dateRange.start': { less_than_equal: sunStr } },
            { 'dateRange.end': { greater_than_equal: monStr } },
          ],
        },
        limit: 1,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      })
      calendar = calendarResult.docs[0]
    }

    if (!calendar) {
      return NextResponse.json({ error: 'No active calendar' }, { status: 404 })
    }

    const responses = (calendar.responses || []) as any[]

    const responseIdx = responses.findIndex((r: any) => r.discordId === discordId)
    if (responseIdx === -1) {
      responses.push({ discordId, scheduleRole, scheduleStatus, selections: {} })
    } else {
      if (scheduleRole !== undefined) responses[responseIdx].scheduleRole = scheduleRole || undefined
      if (scheduleStatus !== undefined) responses[responseIdx].scheduleStatus = scheduleStatus || undefined
    }

    await payload.update({
      collection: 'discord-polls' as any,
      id: calendar.id,
      data: { responses },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Schedule API] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
