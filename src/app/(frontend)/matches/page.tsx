import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { MatchesSearchBar } from '@/components/MatchesSearchBar'
import { MatchesHeader } from './components/MatchesHeader'
import { LiveBanner } from './components/LiveBanner'
import { ClientUpcomingMatches } from './components/ClientUpcomingMatches'
import { PastMatches } from './components/PastMatches'
import { NoResults } from './components/NoResults'
import { ParticleBackground } from '@/components/ParticleBackground'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Match Schedule - ELMT Overwatch 2 Esports | Elemental',
  description: 'View upcoming and past Overwatch 2 esports matches for all ELMT teams. Live match schedules, scores, and VODs from FACEIT leagues.',
  openGraph: {
    title: 'Match Schedule - ELMT Overwatch 2 Esports | Elemental',
    description: 'View upcoming and past Overwatch 2 esports matches for all ELMT teams. Live match schedules, scores, and VODs from FACEIT leagues.',
  },
}

const PAST_MATCHES_PER_PAGE = 12

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const payload = await getPayload({ config: configPromise })

  const params = await searchParams
  const currentPage = Math.max(1, parseInt(params.page || '1', 10))
  const searchQuery = params.q?.toLowerCase() || ''

  // Calculate the cutoff time: matches started more than 2 hours ago are "completed"
  // This matches the getMatchStatus() logic
  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

  // Get upcoming matches (not yet completed) - Only show matches marked for schedule
  // A match is "upcoming" or "live" if it hasn't been started more than 2 hours ago
  let upcomingMatches
  try {
    upcomingMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              greater_than_equal: twoHoursAgo.toISOString(),
            },
          },
          {
            'productionWorkflow.includeInSchedule': {
              equals: true,
            },
          },

        ],
      },
      sort: 'date',
      limit: 100,
      depth: 2, // Populate team and caster relationships
      overrideAccess: false,
    })
  } catch (error) {
    console.error('Error fetching upcoming matches:', error)
    upcomingMatches = { docs: [], totalDocs: 0, page: 1, totalPages: 0 }
  }

  // Get past matches (completed - started more than 2 hours ago) with pagination
  let pastMatches
  try {
    pastMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              less_than: twoHoursAgo.toISOString(),
            },
          },
          {
            'productionWorkflow.includeInSchedule': {
              equals: true,
            },
          },

        ],
      },
      sort: '-date', // Most recent first
      limit: PAST_MATCHES_PER_PAGE,
      page: currentPage,
      depth: 2,
      overrideAccess: false,
    })
  } catch (error) {
    console.error('Error fetching past matches:', error)
    pastMatches = {
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }

  // Filter matches based on search query
  const filterMatches = (matchDocs: any[]) => {
    if (!searchQuery) return matchDocs

    return matchDocs.filter((match) => {
      if (match.title?.toLowerCase().includes(searchQuery)) return true
      if (match.opponent?.toLowerCase().includes(searchQuery)) return true

      const team = match.team && typeof match.team === 'object' ? match.team : null
      if (team?.name?.toLowerCase().includes(searchQuery)) return true
      if (match.region?.toLowerCase().includes(searchQuery)) return true
      if (match.league?.toLowerCase().includes(searchQuery)) return true
      if (match.season?.toLowerCase().includes(searchQuery)) return true

      return false
    })
  }

  // Apply search filter
  const filteredUpcoming = filterMatches(upcomingMatches.docs)
  const filteredPast = filterMatches(pastMatches.docs)

  // Check for live matches (happening right now - within 2 hours of start time)
  // This matches the getMatchStatus() logic used in MatchCard
  const now = new Date()
  const liveMatches = filteredUpcoming.filter((match) => {
    if (!match.date) return false
    const matchDate = new Date(match.date as string)
    const msSinceStart = now.getTime() - matchDate.getTime()
    const hoursSinceStart = msSinceStart / (1000 * 60 * 60)
    // Consider match live if it started within the last 2 hours (consistent with getMatchStatus)
    // Also exclude if match has a score entered (completed)
    const hasScore = match.score?.elmtScore != null && match.score?.opponentScore != null
    return msSinceStart >= 0 && hoursSinceStart <= 2 && !hasScore
  })

  return (
    <div className="relative pt-8 pb-24 min-h-screen animate-fade-in overflow-hidden">
      {/* Subtle background effects */}
      <ParticleBackground particleCount={25} />
      
      <div className="container max-w-5xl relative z-10">
        {/* Header */}
        <MatchesHeader
          upcomingCount={upcomingMatches.totalDocs}
          pastCount={pastMatches.totalDocs}
        />

        {/* Live Now Banner */}
        <LiveBanner liveCount={liveMatches.length} />

        {/* Search Bar */}
        <MatchesSearchBar initialQuery={searchQuery} />

        {/* Upcoming Matches Section */}
        <ClientUpcomingMatches matches={filteredUpcoming} searchQuery={searchQuery} />

        {/* Show message when search returns no results in either section */}
        {searchQuery && filteredUpcoming.length === 0 && filteredPast.length === 0 && (
          <NoResults searchQuery={searchQuery} />
        )}

        {/* Past Matches Section */}
        <PastMatches
          matches={filteredPast}
          totalDocs={pastMatches.totalDocs}
          currentPage={currentPage}
          totalPages={pastMatches.totalPages}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  )
}
