import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { MatchesSearchBar } from '@/components/MatchesSearchBar'
import { MatchesHeader } from './components/MatchesHeader'
import { LiveBanner } from './components/LiveBanner'
import { UpcomingMatches } from './components/UpcomingMatches'
import { PastMatches } from './components/PastMatches'
import { NoResults } from './components/NoResults'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Match Schedule | Elemental (ELMT)',
  description: 'View upcoming and past matches for Elemental teams.',
  openGraph: {
    title: 'Match Schedule | Elemental (ELMT)',
    description: 'View upcoming and past matches for Elemental teams.',
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get upcoming matches (from today onwards) - Only show matches marked for schedule
  let upcomingMatches
  try {
    upcomingMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              greater_than_equal: today.toISOString(),
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

  // Get past matches (before today) with pagination - Only show matches marked for schedule
  let pastMatches
  try {
    pastMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              less_than: today.toISOString(),
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

  // Check for live matches (happening right now - within 4 hours of start time)
  const now = new Date()
  const liveMatches = filteredUpcoming.filter((match) => {
    if (!match.date) return false
    const matchDate = new Date(match.date as string)
    const hoursSinceStart = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60)
    // Consider match live if it started within the last 4 hours and hasn't been marked as completed
    const hasScore = match.score?.elmtScore != null && match.score?.opponentScore != null
    return hoursSinceStart >= 0 && hoursSinceStart <= 4 && !hasScore
  })

  return (
    <div className="pt-8 pb-24 min-h-screen">
      <div className="container max-w-5xl">
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
        <UpcomingMatches matches={filteredUpcoming} searchQuery={searchQuery} />

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
