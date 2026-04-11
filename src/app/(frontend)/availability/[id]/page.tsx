import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { AvailabilityGrid } from './components/AvailabilityGrid'

// Hide from search engines
export const metadata: Metadata = {
  title: 'Team Availability',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AvailabilityPage({ params }: PageProps) {
  const { id } = await params

  // Check Discord identity cookie
  const cookieStore = await cookies()
  const identityCookie = cookieStore.get('discord_identity')
  let discordUser: { id: string; username: string; global_name?: string; avatar?: string | null } | null = null

  if (identityCookie?.value) {
    try {
      discordUser = JSON.parse(identityCookie.value)
    } catch {
      discordUser = null
    }
  }

  // If not authenticated, redirect to Discord OAuth
  if (!discordUser) {
    const clientId = process.env.DISCORD_CLIENT_ID
    if (!clientId) {
      return (
        <div className="availability-page availability-page--error">
          <h1>Configuration Error</h1>
          <p>Discord OAuth is not configured. Please contact an administrator.</p>
        </div>
      )
    }

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const redirectUri = encodeURIComponent(`${host}/api/availability/discord-callback`)
    const state = encodeURIComponent(id)
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`

    redirect(discordAuthUrl)
  }

  // Fetch calendar data server-side
  let calendar: any = null
  let team: any = null

  try {
    const payload = await getPayload({ config: configPromise })
    
    // Try unified collection first (new calendars)
    const result = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        id: { equals: parseInt(id) },
        scheduleType: { equals: 'calendar' },
      },
      limit: 1,
      depth: 1,
    })
    calendar = result.docs[0] || null

    // Fallback to legacy availability-calendars collection (old records)
    if (!calendar) {
      const legacyResult = await payload.find({
        collection: 'availability-calendars' as any,
        where: { id: { equals: parseInt(id) } },
        limit: 1,
        depth: 1,
      })
      if (legacyResult.docs[0]) {
        const legacy = legacyResult.docs[0] as any
        // Normalize legacy field names to match unified shape
        calendar = {
          ...legacy,
          pollName: legacy.title,
        }
      }
    }

    if (calendar?.team && typeof calendar.team === 'object') {
      team = calendar.team
    }
  } catch (err) {
    console.error('[Availability Page] Error fetching calendar:', err)
  }

  if (!calendar) {
    return (
      <div className="availability-page availability-page--error">
        <div className="availability-page__error-content">
          <h1>Calendar Not Found</h1>
          <p>This availability calendar doesn't exist or has been removed.</p>
        </div>
      </div>
    )
  }

  // Get user's existing response
  const responses = (calendar.responses || []) as any[]
  const userResponse = responses.find((r: any) => r.discordId === discordUser!.id)

  return (
    <div className="availability-page">
      <div className="availability-page__container">
        <AvailabilityGrid
          calendarId={parseInt(id)}
          title={calendar.pollName || 'Team Availability'}
          teamName={team?.name ? `ELMT ${team.name}` : 'Team'}
          status={calendar.status}
          dateRange={calendar.dateRange}
          timeSlots={calendar.timeSlots || []}
          timezone={calendar.timezone || 'America/New_York'}
          discordUser={discordUser}
          existingResponse={userResponse || null}
          responseCount={calendar.responseCount || 0}
        />
      </div>
    </div>
  )
}
