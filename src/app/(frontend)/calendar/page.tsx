import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { ParticleBackground } from '@/components/ParticleBackground'
import { CalendarGrid } from './components/CalendarGrid'
import { CalendarHeader } from './components/CalendarHeader'
import { PublicCalendarMonth } from './components/PublicCalendarMonth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Calendar | Elemental (ELMT)',
  description: 'View upcoming competitive esports events, tournaments, and community activities.',
  openGraph: {
    title: 'Calendar | Elemental (ELMT)',
    description: 'View upcoming competitive esports events, tournaments, and community activities.',
  },
}

export default async function CalendarPage() {
  const payload = await getPayload({ config: configPromise })
  
  // Fetch upcoming events (next 90 days)
  const now = new Date()
  
  // Fetch global calendar events
  const events = await payload.find({
    collection: 'global-calendar-events',
    where: {
      or: [
        { dateStart: { greater_than_equal: now.toISOString() } },
        { dateEnd: { greater_than_equal: now.toISOString() } },
      ],
    },
    sort: 'dateStart',
    limit: 100,
    depth: 0,
  })
  
  // Fetch broadcast matches (those marked for schedule)
  const matches = await payload.find({
    collection: 'matches',
    where: {
      and: [
        { date: { greater_than_equal: now.toISOString() } },
        { 'productionWorkflow.includeInSchedule': { equals: true } },
        { status: { not_equals: 'complete' } },
      ],
    },
    sort: 'date',
    limit: 50,
    depth: 1,
  })
  
  // Convert matches to a compatible format for the calendar
  const matchEvents = matches.docs.map((match: any) => ({
    id: `match-${match.id}`,
    title: match.title || `${match.team?.name || 'TBD'} vs ${match.opponent || 'TBD'}`,
    eventType: 'match' as const,
    dateStart: match.date,
    dateEnd: match.date, // Matches are single-day
    description: `${match.region || 'NA'} • ${match.league || 'FACEIT'}`,
    region: match.region || 'na',
    links: match.stream?.url ? [{ label: 'Watch Live', url: match.stream.url }] : [],
  }))
  
  // Combine all events
  const allEvents = [...events.docs, ...matchEvents]
  const totalCount = events.totalDocs + matches.totalDocs
  
  return (
    <div className="relative pt-8 pb-24 min-h-screen animate-fade-in overflow-hidden">
      <ParticleBackground particleCount={25} />
      
      <div className="container max-w-5xl relative z-10">
        <CalendarHeader eventCount={totalCount} />
        <PublicCalendarMonth events={allEvents as any} />
        <CalendarGrid events={allEvents as any} />
      </div>
    </div>
  )
}
