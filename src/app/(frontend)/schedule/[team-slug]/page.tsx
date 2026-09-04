import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SchedulePage } from './components/SchedulePage'
import type { SchedulePageData, ScheduleTab } from '@/components/scheduling/types'
import { nowInTimezone } from '@/utilities/socialMediaDigest'
import { dateFromKey, maintainTeamCalendars, shouldReleaseNextWeek } from '@/utilities/weeklyCalendars'

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
    notFound()
  }

  const team = teamResult.docs[0] as any

  // Check auth via Payload session only
  const cookieStore = await cookies()
  let discordUser: any = null

  const payloadToken = cookieStore.get('payload-token')?.value
  let isSiteAdmin = false
  if (payloadToken) {
    try {
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${payloadToken}` }) })
      if (user) {
        const role = (user as any).role || ''
        isSiteAdmin = role === 'admin' || role === 'staff-manager' || role === 'team-manager'
        if ((user as any).discordId) {
          discordUser = {
            id: (user as any).discordId,
            username: (user as any).name || (user as any).email,
            avatar: null,
          }
        } else if (isSiteAdmin) {
          discordUser = {
            id: `payload-${user.id}`,
            username: (user as any).name || (user as any).email,
            avatar: null,
          }
        }
      }
    } catch {}
  }

  // Only signed-in visitors trigger maintenance writes. Anonymous requests
  // (crawlers, link previews, curl) must never create or mutate rows on GET.
  const canMaintainCalendars = !!discordUser

  // Week boundaries and the next-week release are judged in the team's
  // timezone, the same way the in-process release service does it. The
  // service normally creates calendars first; this is the fallback for a
  // visit before it has run.
  const local = nowInTimezone(team.scheduleTimezone || 'America/New_York')
  const { current: currentWeekCalendar, next: nextWeekCalendar } = await maintainTeamCalendars(payload, team, {
    now: dateFromKey(local.dateKey),
    releaseNextWeek: shouldReleaseNextWeek({
      localDate: local.dateKey,
      localTime: local.hhmm,
      releaseDay: team.nextWeekReleaseDay,
    }),
    canWrite: canMaintainCalendars,
  })

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
    if (!isManager && isSiteAdmin) {
      isManager = true
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
    activeCalendar: currentWeekCalendar || null,
    nextWeekCalendar: nextWeekCalendar || null,
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
