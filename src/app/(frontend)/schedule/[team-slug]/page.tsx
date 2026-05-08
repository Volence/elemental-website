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

  // Check Discord identity
  const cookieStore = await cookies()
  const identityCookie = cookieStore.get('discord_identity')
  let discordUser: any = null
  if (identityCookie?.value) {
    try { discordUser = JSON.parse(identityCookie.value) } catch {}
  }

  // Find active calendar
  const calendarResult = await payload.find({
    collection: 'discord-polls' as any,
    where: {
      and: [
        { team: { equals: team.id } },
        { scheduleType: { equals: 'calendar' } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  // Recent schedules for calendar view
  const recentResult = await payload.find({
    collection: 'discord-polls' as any,
    where: {
      and: [
        { team: { equals: team.id } },
        { scheduleType: { equals: 'calendar' } },
      ],
    },
    limit: 12,
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
