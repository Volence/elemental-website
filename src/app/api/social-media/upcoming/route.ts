import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export interface UpcomingItem {
  id: string
  kind: 'event' | 'match'
  title: string
  date: string
  subtitle: string
  /** Suggested post type for a promo task */
  suggestedPostType: string
  matchId?: number
}

function matchTitle(m: any): string {
  if (m.title && String(m.title).trim()) return m.title
  const teamName = typeof m.team === 'object' && m.team ? m.team.name : ''
  const opponent = m.team2External || m.opponent || 'TBD'
  if (teamName) return `ELMT ${teamName} vs ${opponent}`
  return `ELMT vs ${opponent}`
}

/**
 * GET /api/social-media/upcoming[?days=N]
 * Org calendar events plus matches flagged for the broadcast schedule (or with
 * a stream URL), everything upcoming by default or the next N days, so the
 * social team can plan promo posts.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    const u = user as any
    const allowed = u.role === 'admin' || u.role === 'staff-manager' || u.departments?.isSocialMediaStaff === true
    if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    // No ?days= means everything upcoming; the social team plans further out than two weeks.
    const daysParam = request.nextUrl.searchParams.get('days')
    const days = daysParam ? Math.min(365, Math.max(1, Number(daysParam) || 14)) : null
    const now = new Date()
    const from = new Date(now.getTime() - 6 * 60 * 60 * 1000) // still show things happening right now
    const to = days ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null
    const upTo = (field: string) => (to ? [{ [field]: { less_than_equal: to.toISOString() } }] : [])

    const [events, matches] = await Promise.all([
      payload.find({
        collection: 'global-calendar-events',
        depth: 0,
        limit: 300,
        sort: 'dateStart',
        overrideAccess: true,
        where: {
          and: [
            { dateStart: { greater_than_equal: from.toISOString() } },
            ...upTo('dateStart'),
          ],
        },
      }),
      payload.find({
        collection: 'matches',
        depth: 1,
        limit: 300,
        sort: 'date',
        overrideAccess: true,
        where: {
          and: [
            { date: { greater_than_equal: from.toISOString() } },
            ...upTo('date'),
            { status: { equals: 'scheduled' } },
            {
              or: [
                { 'productionWorkflow.includeInSchedule': { equals: true } },
                { 'stream.url': { exists: true } },
              ],
            },
          ],
        },
      }),
    ])

    const items: UpcomingItem[] = []
    for (const e of events.docs as any[]) {
      const type = e.eventType === 'internal' ? (e.internalEventType || 'internal') : e.eventType
      items.push({
        id: `event-${e.id}`,
        kind: 'event',
        title: e.title,
        date: e.dateStart,
        subtitle: [type, e.region].filter(Boolean).join(' • '),
        suggestedPostType: e.eventType === 'community' || e.eventType === 'internal' ? 'Community Engagement' : 'Match Promo',
      })
    }
    for (const m of matches.docs as any[]) {
      const streamed = m.stream?.url || m.stream?.streamedBy
      items.push({
        id: `match-${m.id}`,
        kind: 'match',
        title: matchTitle(m),
        date: m.date,
        subtitle: [m.league, m.region, streamed ? `Streamed${m.stream?.streamedBy ? ` by ${m.stream.streamedBy}` : ''}` : 'On broadcast schedule']
          .filter(Boolean)
          .join(' • '),
        suggestedPostType: streamed ? 'Stream Announcement' : 'Match Promo',
        matchId: m.id,
      })
    }
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    return NextResponse.json({ items, days })
  } catch (error) {
    console.error('[social-media/upcoming] error:', error)
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
