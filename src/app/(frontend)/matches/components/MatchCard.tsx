'use client'

import React from 'react'
import Link from 'next/link'
import {
  Clock,
  Globe,
  Link as LinkIcon,
  Mic,
  Eye,
  Play,
  ExternalLink,
  Trophy,
} from 'lucide-react'
import { TeamLogo } from '@/components/TeamLogo'
import { SocialLinks } from '@/components/SocialLinks'
import {
  isPopulatedPerson,
  getPersonNameFromRelationship,
  getSocialLinksFromPerson,
} from '@/utilities/personHelpers'
import { getMatchStatus } from '@/utilities/getMatchStatus'
import { LocalDateTime } from '@/components/LocalDateTime'
import { getTierFromRating } from '@/utilities/tierColors'

interface MatchCardProps {
  match: any // TODO: Type this properly with Match type
  showCountdown?: boolean
}

export function MatchCard({ match, showCountdown = true }: MatchCardProps) {
  // Safely parse match date
  let matchDate: Date
  try {
    matchDate = new Date(match.date as string)
    if (isNaN(matchDate.getTime())) {
      matchDate = new Date() // Fallback to current date
    }
  } catch (error) {
    matchDate = new Date() // Fallback to current date
  }

  // Safely extract team relationship (Team 1 - usually the "home" ELMT team)
  const team =
    match.team &&
    typeof match.team === 'object' &&
    match.team !== null &&
    typeof match.team.slug === 'string' &&
    typeof match.team.name === 'string'
      ? match.team
      : // Also check new team1Internal field
        match.team1Internal &&
        typeof match.team1Internal === 'object' &&
        match.team1Internal !== null &&
        typeof match.team1Internal.slug === 'string' &&
        typeof match.team1Internal.name === 'string'
          ? match.team1Internal
          : null

  // Check if Team 2 is also an internal ELMT team (for scrims/showmatches)
  const team2 =
    match.team2Type === 'internal' &&
    match.team2Internal &&
    typeof match.team2Internal === 'object' &&
    match.team2Internal !== null &&
    typeof match.team2Internal.slug === 'string' &&
    typeof match.team2Internal.name === 'string'
      ? match.team2Internal
      : null
  
  const isDualInternalMatch = team && team2

  // Calculate the actual match status based on date
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
      const opponentName = team2?.name || match.opponent || 'TBD'

      if (teamName && opponentName !== 'TBD') {
        title = isDualInternalMatch 
          ? `ELMT ${teamName} vs ELMT ${opponentName}`
          : `ELMT ${teamName} vs ${opponentName}`
      } else if (teamName) {
        title = `ELMT ${teamName} vs TBD`
      } else if (opponentName !== 'TBD') {
        title = `ELMT vs ${opponentName}`
      } else {
        title = 'ELMT Match'
      }
    } else if (team?.name) {
      // Fix existing titles missing "ELMT" prefix for internal teams
      const teamName = team.name
      if (title.startsWith(teamName + ' vs') && !title.startsWith('ELMT ')) {
        title = `ELMT ${title}`
      }
      // Also fix team2 prefix for internal-vs-internal matches
      if (isDualInternalMatch && team2?.name) {
        const vsIndex = title.toLowerCase().indexOf(' vs ')
        if (vsIndex !== -1) {
          const afterVs = title.substring(vsIndex + 4).trim()
          if (afterVs === team2.name || afterVs.toLowerCase() === team2.name.toLowerCase()) {
            title = title.substring(0, vsIndex + 4) + `ELMT ${team2.name}`
          }
        }
      }
    }

    // For dual internal matches, make both team names links
    if (isDualInternalMatch && team && team2) {
      const vsIndex = title.toLowerCase().indexOf(' vs ')
      if (vsIndex !== -1) {
        const beforeVs = title.substring(0, vsIndex).trim()
        const afterVs = title.substring(vsIndex + 4).trim()
        
        return (
          <span>
            <Link href={`/teams/${team.slug}`} className="text-primary hover:underline">
              {beforeVs}
            </Link>
            {' vs '}
            <Link href={`/teams/${team2.slug}`} className="text-primary hover:underline">
              {afterVs}
            </Link>
          </span>
        )
      }
    }

    // If no valid team relationship, just show title as-is
    if (!team || !team.slug || !team.name) {
      return <span>{title}</span>
    }

    // Try to find the team name in the title (usually before "vs")
    const teamName = team.name

    // Check if title contains team name followed by "vs" or "VS"
    const vsIndex = title.toLowerCase().indexOf(' vs ')
    if (vsIndex === -1) {
      // No "vs" found, just show title as-is
      return <span>{title}</span>
    }

    // Extract the part before "vs" (should be the ELMT team)
    const beforeVs = title.substring(0, vsIndex).trim()
    const afterVs = title.substring(vsIndex + 4).trim() // +4 for " vs "

    // Check if the part before "vs" matches our team name (case-insensitive)
    const normalizedBeforeVs = beforeVs.toLowerCase()
    const normalizedTeamName = teamName.toLowerCase()

    if (
      normalizedBeforeVs === normalizedTeamName ||
      normalizedBeforeVs === `elmt ${normalizedTeamName}` ||
      normalizedBeforeVs.includes(normalizedTeamName)
    ) {
      // Make the ELMT team name a link
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

    // Team name not found in expected position, show title as-is
    return <span>{title}</span>
  }

  // Calculate countdown
  const renderCountdown = () => {
    if (!showCountdown) return null

    const now = new Date()
    const timeUntil = matchDate.getTime() - now.getTime()

    if (timeUntil < 0) return null // Match already started

    const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60))
    const totalHours = Math.floor(timeUntil / (1000 * 60 * 60))

    let countdownText = ''
    if (days >= 2) {
      // 2+ days: show "Xd"
      countdownText = `${days}d`
    } else if (totalHours >= 24) {
      // 24-48 hours: show "1d Xh"
      countdownText = `${days}d ${hours}h`
    } else if (totalHours >= 1) {
      // 1-24 hours: show "Xh Ym"
      countdownText = `${totalHours}h ${minutes}m`
    } else if (minutes >= 5) {
      // 5-60 minutes: show "Xm"
      countdownText = `${minutes}m`
    } else {
      // Less than 5 minutes
      countdownText = 'Starting soon'
    }

    const isUrgent = totalHours < 1 && timeUntil > 0

    return (
      <span
        className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
          isUrgent
            ? 'bg-orange-500/20 text-orange-500 border border-orange-500/50 animate-pulse'
            : 'bg-primary/10 text-primary'
        }`}
      >
        ⏱ {countdownText}
      </span>
    )
  }

  // Render producers/observers
  const renderProducersObservers = () => {
    // Handle old format (single observer object) - for backward compatibility
    const streamData = match.stream as any
    const oldObserver = streamData?.observer
    const hasNewFormat = match.producersObservers && match.producersObservers.length > 0

    if (oldObserver && !hasNewFormat) {
      // Legacy support for old observer format
      if (typeof oldObserver === 'string') {
        return (
          <div className="flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Observer: </span>
            <span className="font-medium">{oldObserver}</span>
          </div>
        )
      }

      const observerCaster =
        oldObserver.caster &&
        typeof oldObserver.caster === 'object' &&
        oldObserver.caster !== null
          ? oldObserver.caster
          : null
      // Prioritize person relationship, then legacy name fields
      const observerPerson = isPopulatedPerson(observerCaster?.person)
        ? observerCaster.person
        : null
      const observerName =
        getPersonNameFromRelationship(observerCaster?.person) ||
        observerCaster?.name ||
        oldObserver.name ||
        null

      if (!observerName) return null

      const observerSlug = observerCaster?.slug

      return (
        <div className="flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Observer: </span>
          {observerCaster && observerSlug ? (
            <Link
              href={`/production/${observerSlug}`}
              className="font-medium text-primary hover:underline"
            >
              {observerName}
            </Link>
          ) : (
            <span className="font-medium">{observerName}</span>
          )}
          {(() => {
            if (!observerCaster) return null

            const socialLinks = getSocialLinksFromPerson(observerCaster.person, {
              twitter: observerCaster.twitter,
              twitch: observerCaster.twitch,
              youtube: observerCaster.youtube,
              instagram: observerCaster.instagram,
            })

            const hasSocialLinks =
              socialLinks.twitter ||
              socialLinks.twitch ||
              socialLinks.youtube ||
              socialLinks.instagram
            if (!hasSocialLinks) return null

            return <SocialLinks links={socialLinks} />
          })()}
        </div>
      )
    }

    // Handle new format (producersObservers array)
    const producersObservers = match.producersObservers
    if (!producersObservers || producersObservers.length === 0) return null

    return (
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Producers/Observers: </span>
        <div className="flex items-center gap-2 flex-wrap">
          {producersObservers
            .filter((entry: any) => {
              // Filter out entries with no name
              if (typeof entry === 'string') return true
              const staff =
                entry.staff && typeof entry.staff === 'object' && entry.staff !== null
                  ? entry.staff
                  : null
              // Check person relationship first, then legacy name fields
              const personName = getPersonNameFromRelationship(staff?.person)
              return personName || staff?.name || entry.name
            })
            .map((entry: any, idx: number, arr: any[]) => {
              // Handle old format (string) - shouldn't happen but for safety
              if (typeof entry === 'string') {
                return (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="font-medium">{entry}</span>
                    {idx < arr.length - 1 && <span className="text-muted-foreground">&</span>}
                  </div>
                )
              }

              // Handle new format (object) - prioritize person relationship
              const staff =
                entry.staff && typeof entry.staff === 'object' && entry.staff !== null
                  ? entry.staff
                  : null
              const name =
                getPersonNameFromRelationship(staff?.person) ||
                staff?.name ||
                entry.name ||
                null

              if (!name) return <React.Fragment key={idx} />

              // If staff relationship exists, make it a link
              const staffSlug = staff?.slug

              return (
                <div key={idx} className="flex items-center gap-1">
                  {staff && staffSlug ? (
                    <Link
                      href={`/production/${staffSlug}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="font-medium">{name}</span>
                  )}
                  {(() => {
                    if (!staff) return null

                    const socialLinks = getSocialLinksFromPerson(staff.person, {
                      twitter: staff.twitter,
                      twitch: staff.twitch,
                      youtube: staff.youtube,
                      instagram: staff.instagram,
                    })

                    const hasSocialLinks =
                      socialLinks.twitter ||
                      socialLinks.twitch ||
                      socialLinks.youtube ||
                      socialLinks.instagram
                    if (!hasSocialLinks) return null

                    return <SocialLinks links={socialLinks} />
                  })()}
                  {idx < arr.length - 1 && <span className="text-muted-foreground mx-1">&</span>}
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  // Render casters
  const renderCasters = () => {
    if (!match.casters || match.casters.length === 0) return null

    return (
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Mic className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Production Staff: </span>
        <div className="flex items-center gap-2 flex-wrap">
          {match.casters
            .filter((casterEntry: any) => {
              // Filter out entries with no name
              if (typeof casterEntry === 'string') return true
              const caster =
                casterEntry.caster &&
                typeof casterEntry.caster === 'object' &&
                casterEntry.caster !== null
                  ? casterEntry.caster
                  : null
              // Check person relationship first, then legacy name fields
              const personName = getPersonNameFromRelationship(caster?.person)
              return personName || caster?.name || casterEntry.name
            })
            .map((casterEntry: any, idx: number, arr: any[]) => {
              // Handle old format (string)
              if (typeof casterEntry === 'string') {
                return (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="font-medium">{casterEntry}</span>
                    {idx < arr.length - 1 && <span className="text-muted-foreground">&</span>}
                  </div>
                )
              }

              // Handle new format (object) - prioritize person relationship
              const caster =
                casterEntry.caster &&
                typeof casterEntry.caster === 'object' &&
                casterEntry.caster !== null
                  ? casterEntry.caster
                  : null
              const name =
                getPersonNameFromRelationship(caster?.person) ||
                caster?.name ||
                casterEntry.name ||
                null

              if (!name) return <React.Fragment key={idx} />

              // If caster relationship exists, make it a link
              const casterSlug = caster?.slug

              return (
                <div key={idx} className="flex items-center gap-1">
                  {caster && casterSlug ? (
                    <Link
                      href={`/production/${casterSlug}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="font-medium">{name}</span>
                  )}
                  {(() => {
                    if (!caster) return null

                    const socialLinks = getSocialLinksFromPerson(caster.person, {
                      twitter: caster.twitter,
                      twitch: caster.twitch,
                      youtube: caster.youtube,
                      instagram: caster.instagram,
                    })

                    const hasSocialLinks =
                      socialLinks.twitter ||
                      socialLinks.twitch ||
                      socialLinks.youtube ||
                      socialLinks.instagram
                    if (!hasSocialLinks) return null

                    return <SocialLinks links={socialLinks} />
                  })()}
                  {idx < arr.length - 1 && <span className="text-muted-foreground">&</span>}
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  return (
    <div
      key={match.id}
      className="p-8 border-t-2 border-r-2 border-b-2 border-border rounded-xl bg-gradient-to-br from-card to-card/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-200 relative overflow-hidden"
      style={{ 
        borderLeft: `4px solid ${tierColors.borderColor}`,
        boxShadow: `inset 4px 0 12px -8px ${tierColors.borderColor}, 0 10px 15px -3px rgba(0, 0, 0, 0.1)`
      }}
    >
      {/* Subtle tier color background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          backgroundColor: tierColors.borderColor,
          opacity: 0.05
        }}
      ></div>
      <div className="relative z-10">
      {/* Header with Team Logos and Status */}
      <div className="flex items-center justify-between gap-6 mb-6">
        {/* Team Logo(s) */}
        {isDualInternalMatch ? (
          // Dual internal match: Show both ELMT team logos
          <div className="flex items-center gap-3">
            <Link href={`/teams/${team.slug}`} className="flex flex-col items-center gap-1 group">
              <div className="relative w-14 h-14 rounded-lg bg-gradient-to-br from-white/10 to-white/5 ring-2 ring-primary/30 group-hover:ring-primary/60 p-2 flex-shrink-0 transition-all">
                <TeamLogo
                  src={team.logo}
                  logoFilename={team.logoFilename}
                  alt={`${team.name} Logo`}
                  fill
                  className="object-contain"
                  sizes="56px"
                />
              </div>
              <span className="text-xs font-bold text-primary">{team.name}</span>
            </Link>
            <span className="text-lg font-bold text-muted-foreground">VS</span>
            <Link href={`/teams/${team2.slug}`} className="flex flex-col items-center gap-1 group">
              <div className="relative w-14 h-14 rounded-lg bg-gradient-to-br from-white/10 to-white/5 ring-2 ring-primary/30 group-hover:ring-primary/60 p-2 flex-shrink-0 transition-all">
                <TeamLogo
                  src={team2.logo}
                  logoFilename={team2.logoFilename}
                  alt={`${team2.name} Logo`}
                  fill
                  className="object-contain"
                  sizes="56px"
                />
              </div>
              <span className="text-xs font-bold text-primary">{team2.name}</span>
            </Link>
          </div>
        ) : team && (team.logo || team.logoFilename) ? (
          // Standard match: Single ELMT team logo
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-lg bg-gradient-to-br from-white/10 to-white/5 ring-2 ring-white/20 p-2 flex-shrink-0">
              <TeamLogo
                src={team.logo}
                logoFilename={team.logoFilename}
                alt={`${team.name} Logo`}
                fill
                className="object-contain"
                sizes="64px"
              />
            </div>
            <div className="text-sm font-bold text-primary">ELMT {team.name}</div>
          </div>
        ) : null}

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* League Badge */}
          {match.league && (
            <span 
              className="px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-1"
              style={{
                backgroundColor: `${tierColors.borderColor}15`,
                color: tierColors.borderColor,
                borderColor: `${tierColors.borderColor}50`
              }}
            >
              <Trophy className="w-3 h-3" />
              {match.league}
            </span>
          )}

          {/* Status Badge */}
          <span
            className={`
                                  px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider
                                  ${displayStatus === 'live' ? 'bg-red-500/20 text-red-500 border-2 border-red-500/50 animate-pulse-glow' : ''}
                                  ${displayStatus === 'completed' ? 'bg-gray-500/10 text-gray-500 border border-gray-500/20' : ''}
                                  ${displayStatus === 'upcoming' ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30' : ''}
                                  ${displayStatus === 'cancelled' ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30' : ''}
                                `}
          >
            {displayStatus}
          </span>
        </div>
      </div>

      {/* Match Title */}
      <h3 className="text-2xl font-black mb-6">{renderMatchTitle()}</h3>

      {/* Match Info */}
      <div className="space-y-3">
        {/* Region/League */}
        {(match.region || match.league) && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {match.region || 'TBD'} / {match.league || 'TBD'}
              {match.season && ` • ${match.season}`}
            </span>
          </div>
        )}

        {/* Date & Time with Countdown */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <LocalDateTime date={matchDate} format="full" className="text-muted-foreground" />
          {renderCountdown()}
        </div>

        {/* Stream Info */}
        {match.stream?.url && (
          <div className="flex items-center gap-2 text-sm">
            <Play className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Stream: </span>
            <a
              href={match.stream.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {match.stream.streamedBy || match.stream.url}
            </a>
          </div>
        )}

        {/* Producers/Observers */}
        {renderProducersObservers()}

        {/* Casters */}
        {renderCasters()}

        {/* FACEIT Lobby */}
        {match.faceitLobby && (
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">FACEIT Lobby: </span>
            <a
              href={match.faceitLobby}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              View Lobby
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* VOD Link */}
        {match.vod && (
          <div className="flex items-center gap-2 text-sm">
            <Play className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">VOD: </span>
            <a
              href={match.vod}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              Watch Replay
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Score Display (if completed) */}
        {displayStatus === 'completed' &&
          match.score?.elmtScore !== undefined &&
          match.score?.opponentScore !== undefined && (
            <div className="mt-4 inline-flex items-center gap-4 px-4 py-2 rounded-lg bg-muted/30 border border-border">
              <span
                className={`text-2xl font-bold ${
                  match.score.elmtScore > match.score.opponentScore
                    ? 'text-green-400/90'
                    : match.score.elmtScore < match.score.opponentScore
                      ? 'text-red-400/90'
                      : 'text-foreground'
                }`}
              >
                {match.score.elmtScore}
              </span>
              <span className="text-muted-foreground font-medium">-</span>
              <span
                className={`text-2xl font-bold ${
                  match.score.opponentScore > match.score.elmtScore
                    ? 'text-green-400/90'
                    : match.score.opponentScore < match.score.elmtScore
                      ? 'text-red-400/90'
                      : 'text-foreground'
                }`}
              >
                {match.score.opponentScore}
              </span>
              {match.score.elmtScore !== match.score.opponentScore && (
                <span className="ml-2 text-xs font-semibold text-muted-foreground uppercase">
                  {match.score.elmtScore > match.score.opponentScore ? 'W' : 'L'}
                </span>
              )}
            </div>
          )}
      </div>
      </div>
    </div>
  )
}

