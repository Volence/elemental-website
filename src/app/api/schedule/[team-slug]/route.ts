import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function getDiscordIdentity(request: NextRequest, payload: any) {
  const payloadToken = request.cookies.get('payload-token')?.value
  if (payloadToken) {
    try {
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${payloadToken}` }) })
      if (user && (user as any).discordId) {
        return {
          id: (user as any).discordId,
          username: (user as any).name || (user as any).email,
          avatar: null,
        }
      }
    } catch {}
  }

  const cookie = request.cookies.get('discord_identity')
  if (!cookie?.value) return null
  try {
    return JSON.parse(cookie.value)
  } catch {
    return null
  }
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
      depth: 0,
      overrideAccess: true,
    })

    const activeCalendar = calendarResult.docs[0] || null

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
