'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar, Globe, Play, ExternalLink, Trophy } from 'lucide-react'
import { TeamLogo } from '@/components/TeamLogo'
import { getMatchStatus } from '@/utilities/getMatchStatus'
import { LocalDateTime } from '@/components/LocalDateTime'
import { getTierFromRating } from '@/utilities/tierColors'

interface PastMatchCardProps {
  match: any // TODO: Type this properly with Match type
}

export function PastMatchCard({ match }: PastMatchCardProps) {
  // Safely parse match date
  let matchDate: Date
  try {
    matchDate = new Date(match.date as string)
    if (isNaN(matchDate.getTime())) {
      matchDate = new Date()
    }
  } catch (error) {
    matchDate = new Date()
  }

  // Safely extract team relationship
  const team =
    match.team &&
    typeof match.team === 'object' &&
    match.team !== null &&
    typeof match.team.slug === 'string' &&
    typeof match.team.name === 'string'
      ? match.team
      : null

  const displayStatus = getMatchStatus(
    match.date as string,
    (match.status as 'scheduled' | 'cancelled') || 'scheduled',
  )

  // Get tier colors based on league or team rating
  const tierColors = getTierFromRating(match.league || team?.rating)

  // Parse match title to make ELMT team name clickable
  const renderMatchTitle = () => {
    let title = match.title || ''

    // If title is empty, generate one from team + opponent
    if (!title || title.trim() === '') {
      const teamName = team?.name || ''
      const opponent = match.opponent || 'TBD'

      if (teamName && opponent !== 'TBD') {
        title = `ELMT ${teamName} vs ${opponent}`
      } else if (teamName) {
        title = `ELMT ${teamName} vs TBD`
      } else if (opponent !== 'TBD') {
        title = `ELMT vs ${opponent}`
      } else {
        title = 'ELMT Match'
      }
    }

    if (!team || !team.slug || !team.name) {
      return <span>{title}</span>
    }

    const vsIndex = title.toLowerCase().indexOf(' vs ')
    if (vsIndex === -1) {
      return <span>{title}</span>
    }

    const beforeVs = title.substring(0, vsIndex).trim()
    const afterVs = title.substring(vsIndex + 4).trim()

    const normalizedBeforeVs = beforeVs.toLowerCase()
    const normalizedTeamName = team.name.toLowerCase()

    if (
      normalizedBeforeVs === normalizedTeamName ||
      normalizedBeforeVs === `elmt ${normalizedTeamName}` ||
      normalizedBeforeVs.includes(normalizedTeamName)
    ) {
      return (
        <span>
          <Link href={`/teams/${team.slug}`} className="text-primary hover:underline">
            {beforeVs}
          </Link>
          {' vs '}
          {afterVs}
        </span>
      )
    }

    return <span>{title}</span>
  }

  return (
    <div 
      className="p-6 border-t-2 border-r-2 border-b-2 border-border rounded-xl bg-gradient-to-br from-card to-card/50 shadow-lg hover:border-primary/20 hover:shadow-xl transition-all duration-200 relative overflow-hidden"
      style={{ 
        borderLeft: `4px solid ${tierColors.borderColor}`,
        boxShadow: `inset 4px 0 12px -8px ${tierColors.borderColor}`
      }}
    >
      {/* Header with Team Logo and Badges */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Team Logo and Title */}
        <div className="flex items-center gap-4 flex-1">
          {team && team.logo && (
            <div className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-white/10 to-white/5 ring-2 ring-white/15 p-1.5 flex-shrink-0">
              <TeamLogo
                src={team.logo}
                alt={`${team.name} Logo`}
                fill
                className="object-contain"
                sizes="48px"
              />
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold mb-1">{renderMatchTitle()}</h3>
            <div className="flex items-center gap-2">
              {match.league && (
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                  {match.league}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`
                            px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide flex-shrink-0
                            ${displayStatus === 'completed' ? 'bg-gray-500/10 text-gray-500 border border-gray-500/20' : ''}
                            ${displayStatus === 'cancelled' ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30' : ''}
                          `}
        >
          {displayStatus}
        </span>
      </div>

      {/* Score Display */}
      {match.score?.elmtScore != null && match.score?.opponentScore != null && (
        <div className="mb-3 inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/30 border border-border">
          <span
            className={`text-xl font-bold ${
              match.score.elmtScore! > match.score.opponentScore!
                ? 'text-green-400/90'
                : match.score.elmtScore! < match.score.opponentScore!
                  ? 'text-red-400/90'
                  : 'text-foreground'
            }`}
          >
            {match.score.elmtScore}
          </span>
          <span className="text-muted-foreground font-medium">-</span>
          <span
            className={`text-xl font-bold ${
              match.score.opponentScore! > match.score.elmtScore!
                ? 'text-green-400/90'
                : match.score.opponentScore! < match.score.elmtScore!
                  ? 'text-red-400/90'
                  : 'text-foreground'
            }`}
          >
            {match.score.opponentScore}
          </span>
          {match.score.elmtScore! !== match.score.opponentScore! && (
            <span className="ml-1 text-xs font-semibold text-muted-foreground uppercase">
              {match.score.elmtScore! > match.score.opponentScore! ? 'W' : 'L'}
            </span>
          )}
        </div>
      )}

      {/* Match Info - Condensed for past matches */}
      <div className="space-y-2 text-sm">
        {/* Date */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <LocalDateTime date={matchDate} format="date-only" className="text-muted-foreground" />
        </div>

        {/* Region/League */}
        {(match.region || match.league) && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {match.region || 'TBD'} / {match.league || 'TBD'}
              {match.season && ` • ${match.season}`}
            </span>
          </div>
        )}

        {/* VOD Link (prioritize for past matches) */}
        {match.vod && (
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">VOD: </span>
            <a
              href={match.vod}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 font-medium"
            >
              Watch Replay
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

