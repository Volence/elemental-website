import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SchedulePage } from './components/SchedulePage'
import type { SchedulePageData, ScheduleTab } from '@/components/scheduling/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ 'team-slug': string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { 'team-slug': slug } = await params
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return {
    title: `${name} Schedule | Elemental`,
    robots: { index: false, follow: false },
  }
}

export default async function SchedulePageRoute({ params, searchParams }: PageProps) {
  const { 'team-slug': teamSlug } = await params
  const { tab } = await searchParams
  const initialTab: ScheduleTab = (tab === 'calendar' || tab === 'build') ? tab : 'availability'

  const payload = await getPayload({ config: configPromise })

  // Find team by slug
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
    return (
      <div className="schedule-page schedule-page--error">
        <h1>Team Not Found</h1>
        <p>This team doesn't exist or is no longer active.</p>
      </div>
    )
  }

  const team = teamResult.docs[0] as any

  // Check auth: Payload session first, then Discord identity cookie
  const cookieStore = await cookies()
  let discordUser: any = null

  const payloadToken = cookieStore.get('payload-token')?.value
  if (payloadToken) {
    try {
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${payloadToken}` }) })
      if (user && (user as any).discordId) {
        discordUser = {
          id: (user as any).discordId,
          username: (user as any).name || (user as any).email,
          avatar: (user as any).discordAvatar || null,
        }
      }
    } catch {}
  }

  if (!discordUser) {
    const identityCookie = cookieStore.get('discord_identity')
    if (identityCookie?.value) {
      try { discordUser = JSON.parse(identityCookie.value) } catch {}
    }
  }

  // Calculate current week boundaries (Mon-Sun)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const mondayStr = monday.toISOString().split('T')[0]
  const sundayStr = sunday.toISOString().split('T')[0]

  // Close expired active calendars for this team
  const expiredCalendars = await payload.find({
    collection: 'discord-polls' as any,
    where: {
      and: [
        { team: { equals: team.id } },
        { scheduleType: { equals: 'calendar' } },
        { status: { equals: 'active' } },
        { 'dateRange.end': { less_than: mondayStr } },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  for (const expired of expiredCalendars.docs) {
    await payload.update({
      collection: 'discord-polls' as any,
      id: expired.id,
      data: { status: 'closed' },
      overrideAccess: true,
    })
  }

  // Find active calendar for current week
  let calendarResult = await payload.find({
    collection: 'discord-polls' as any,
    where: {
      and: [
        { team: { equals: team.id } },
        { scheduleType: { equals: 'calendar' } },
        { status: { equals: 'active' } },
        { 'dateRange.start': { less_than_equal: sundayStr } },
        { 'dateRange.end': { greater_than_equal: mondayStr } },
      ],
    },
    limit: 1,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  // Auto-create calendar for current week if none exists
  if (calendarResult.docs.length === 0) {
    const monthDay = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const scheduleBlocks = team.scheduleBlocks || []
    const timeSlots = scheduleBlocks.map((b: any) => ({
      id: `auto_${b.startTime}_${Date.now()}`,
      label: b.label,
      startTime: b.startTime,
      endTime: b.endTime,
    }))

    try {
      const created = await payload.create({
        collection: 'discord-polls' as any,
        data: {
          pollName: `Week of ${monthDay}`,
          team: team.id,
          scheduleType: 'calendar',
          status: 'active',
          dateRange: { start: mondayStr, end: sundayStr },
          timeSlots: timeSlots.length > 0 ? timeSlots : undefined,
          timezone: team.scheduleTimezone || 'America/New_York',
          createdVia: 'auto',
          responses: [],
          responseCount: 0,
        },
        overrideAccess: true,
      })
      calendarResult = { docs: [created], totalDocs: 1, totalPages: 1, page: 1, pagingCounter: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null, limit: 1 } as any
    } catch (err) {
      console.error('[Schedule] Auto-create calendar error:', err)
    }
  }

  // Recent schedules for calendar view (include both poll and calendar types for history)
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

  // Absences
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
    overrideAccess: true,
  })

  // Determine auth state
  let isManager = false
  let isOnRoster = false
  let playerId: string | undefined

  if (discordUser) {
    const allRoster = [...(team.roster || []), ...(team.subs || [])]
    for (const entry of allRoster) {
      const person = typeof entry.person === 'object' ? entry.person : null
      if (person?.discordId === discordUser.id) {
        isOnRoster = true
        playerId = String(person.id)
        break
      }
    }

    const staffArrays = [team.manager || [], team.coaches || [], team.captain || []]
    for (const arr of staffArrays) {
      for (const entry of arr) {
        const person = typeof entry === 'object' ? entry : null
        if (person?.discordId === discordUser.id) { isManager = true; break }
      }
      if (isManager) break
    }
    if (!isManager && team.coCaptain) {
      const co = typeof team.coCaptain === 'object' ? team.coCaptain : null
      if (co?.discordId === discordUser.id) isManager = true
    }
  }

  // Build roster data
  const roster = (team.roster || [])
    .filter((e: any) => e.person && typeof e.person === 'object')
    .map((e: any) => ({
      person: { id: e.person.id, name: e.person.name, discordId: e.person.discordId, discordAvatar: e.person.discordAvatar },
      role: e.role,
    }))

  const subs = (team.subs || [])
    .filter((e: any) => e.person && typeof e.person === 'object')
    .map((e: any) => ({
      person: { id: e.person.id, name: e.person.name, discordId: e.person.discordId, discordAvatar: e.person.discordAvatar },
      role: e.role,
    }))

  const pageData: SchedulePageData = {
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      roster,
      subs,
      scheduleBlocks: team.scheduleBlocks || [],
      scheduleTimezone: team.scheduleTimezone || 'America/New_York',
      rolePreset: team.rolePreset || 'specific',
      customRoles: team.customRoles,
      discordThreads: team.discordThreads || {},
    },
    activeCalendar: calendarResult.docs[0] || null,
    recentSchedules: recentResult.docs,
    absences: absenceResult.docs as any[],
    authState: {
      isAuthenticated: !!discordUser,
      discordUser: discordUser ? { id: discordUser.id, username: discordUser.username, avatar: discordUser.avatar } : undefined,
      isManager,
      isOnRoster,
      playerId,
    },
  }

  return (
    <div className="schedule-page">
      <SchedulePage initialData={pageData} initialTab={initialTab} />
    </div>
  )
}
