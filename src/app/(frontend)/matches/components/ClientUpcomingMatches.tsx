'use client'

import React from 'react'
import { Calendar } from 'lucide-react'
import Link from 'next/link'
import { MatchCard } from './MatchCard'
import { getLocalDateKey, formatLocalDateLabel } from '@/components/LocalDateTime'
import { getMatchStatus } from '@/utilities/getMatchStatus'
import type { Match } from '@/payload-types'

interface ClientUpcomingMatchesProps {
  matches: Match[]
  searchQuery?: string
}

/**
 * Client-side component for grouping and displaying upcoming matches.
 * Uses the user's local timezone for date grouping and display.
 * Filters out matches that are already completed (more than 2 hours past start time).
 */
export function ClientUpcomingMatches({ matches, searchQuery }: ClientUpcomingMatchesProps) {
  // Filter out completed matches - they should appear in Past Matches instead
  const activeMatches = matches.filter((match) => {
    if (!match.date) return false
    const status = getMatchStatus(match.date, (match.status || 'scheduled') as 'scheduled' | 'cancelled')
    // Only show upcoming and live matches, not completed ones
    return status === 'upcoming' || status === 'live'
  })

  // Group matches by day in user's local timezone
  const groupMatchesByDay = (matchDocs: any[]) => {
    const grouped: Record<string, any[]> = {}

    matchDocs.forEach((match) => {
      if (!match.date) return

      try {
        const matchDate = new Date(match.date as string)
        if (isNaN(matchDate.getTime())) return

        // Get the date key in user's local timezone
        const dateKey = getLocalDateKey(matchDate)

        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(match)
      } catch (error) {
        console.error('Invalid date for match:', match.id, error)
      }
    })

    return grouped
  }

  const matchesByDay = groupMatchesByDay(activeMatches)

  // Show section when no search query or when there are results
  if (searchQuery && activeMatches.length === 0) {
    return null
  }

  return (
    <div id="upcoming-matches" className="mb-16 animate-fade-in scroll-mt-24">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <div className="w-2 h-8 bg-primary rounded-full" />
        Upcoming Matches
      </h2>
      {activeMatches.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-card to-card/50 rounded-xl border-2 border-dashed border-border">
          <div className="max-w-md mx-auto">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-2xl font-bold mb-3">No Upcoming Matches</h3>
            <p className="text-muted-foreground mb-6">
              Check back soon for the latest match schedule.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="#past-matches"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                View Past Matches
              </Link>
              <Link
                href="/teams"
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors font-medium"
              >
                Browse Teams
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(matchesByDay).map(([dateKey, dayMatches]) => {
            // Format the date label in user's local timezone
            const dateLabel = formatLocalDateLabel(dateKey)

            return (
              <div key={dateKey}>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 px-3">
                  {dateLabel}
                </h3>
                <div className="space-y-6">
                  {dayMatches
                    .filter((match) => {
                      if (!match.date) return false
                      const matchDate = new Date(match.date as string)
                      return !isNaN(matchDate.getTime())
                    })
                    .map((match) => (
                      <MatchCard key={match.id} match={match} showCountdown={true} />
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
