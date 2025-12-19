import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Calendar, Clock, Globe, Link as LinkIcon, Mic, Eye, Play, ExternalLink, ChevronLeft, ChevronRight, Search, Trophy } from 'lucide-react'
import Link from 'next/link'
import { SocialLinks } from '@/components/SocialLinks'
import { isPopulatedPerson, getPersonNameFromRelationship, getSocialLinksFromPerson } from '@/utilities/personHelpers'
import { getMatchStatus } from '@/utilities/getMatchStatus'
import { MatchesSearchBar } from '@/components/MatchesSearchBar'
import { TeamLogo } from '@/components/TeamLogo'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Match Schedule | Elemental (ELMT)',
  description: 'View upcoming and past matches for Elemental teams.',
  openGraph: {
    title: 'Match Schedule | Elemental (ELMT)',
    description: 'View upcoming and past matches for Elemental teams.',
  },
}

function getWeekRange(date: Date = new Date()) {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return { startOfWeek, endOfWeek }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function convertToEST(date: Date): string {
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return formatTime(estDate) + ' EST'
}

function convertToCET(date: Date): string {
  const cetDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  return formatTime(cetDate) + ' CET'
}

const PAST_MATCHES_PER_PAGE = 12

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  // Page is force-dynamic, so it always renders at runtime with fresh data
  const payload = await getPayload({ config: configPromise })
  
  const params = await searchParams
  const currentPage = Math.max(1, parseInt(params.page || '1', 10))
  const searchQuery = params.q?.toLowerCase() || ''
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get upcoming matches (from today onwards)
  let upcomingMatches
  try {
    upcomingMatches = await payload.find({
      collection: 'matches',
      where: {
        date: {
          greater_than_equal: today.toISOString(),
        },
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

  // Get past matches (before today) with pagination
  let pastMatches
  try {
    pastMatches = await payload.find({
      collection: 'matches',
      where: {
        date: {
          less_than: today.toISOString(),
        },
      },
      sort: '-date', // Most recent first
      limit: PAST_MATCHES_PER_PAGE,
      page: currentPage,
      depth: 2,
      overrideAccess: false,
    })
  } catch (error) {
    console.error('Error fetching past matches:', error)
    pastMatches = { docs: [], totalDocs: 0, page: 1, totalPages: 0, hasNextPage: false, hasPrevPage: false }
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

  // Alias for backward compatibility
  const matches = { ...upcomingMatches, docs: filteredUpcoming }
  const filteredPastMatches = { ...pastMatches, docs: filteredPast }

  // Helper function to group matches by day
  const groupMatchesByDay = (matchDocs: any[]) => {
    const grouped: Record<string, any[]> = {}
    
    matchDocs.forEach((match) => {
      if (!match.date) return
      
      try {
        const matchDate = new Date(match.date as string)
        if (isNaN(matchDate.getTime())) return
        
        const dateKey = matchDate.toISOString().split('T')[0]
        
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
  
  const matchesByDay = groupMatchesByDay(matches.docs)

  return (
    <div className="pt-8 pb-24 min-h-screen">
      <div className="container max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)' }}>
            Matches
          </h1>
          <div className="w-32 h-1.5 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_30px_rgba(56,189,248,0.5)] rounded-full" />
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            ELMT Match Schedule & Results
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-base">
            {matches.totalDocs > 0 && (
              <span className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <strong className="text-primary font-bold">{matches.totalDocs}</strong> <span className="text-muted-foreground">Upcoming</span>
              </span>
            )}
            {pastMatches.totalDocs > 0 && (
              <span className="px-4 py-2 rounded-lg bg-card border border-border">
                <strong className="font-bold">{pastMatches.totalDocs}</strong> <span className="text-muted-foreground">Completed</span>
              </span>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <MatchesSearchBar initialQuery={searchQuery} />

        {/* Upcoming Matches Section */}
        {/* Hide section when searching and no results found */}
        {(!searchQuery || matches.docs.length > 0) && (
        <div className="mb-16 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <div className="w-2 h-8 bg-primary rounded-full" />
            Upcoming Matches
          </h2>
          {matches.docs.length === 0 ? (
            <div className="text-center py-12 bg-card/30 rounded-xl border border-border">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No upcoming matches scheduled.</p>
              {filteredPastMatches.docs.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">Check out past matches below</p>
              )}
            </div>
          ) : (
          <div className="space-y-8 mb-16">
            {Object.entries(matchesByDay)
              .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
              .map(([dateKey, dayMatches]) => {
                const dayDate = new Date(dateKey)
                const dayFormatted = formatDate(dayDate)

                return (
                  <div key={dateKey} className="space-y-4">
                    <h2 className="text-2xl font-bold mb-4">{dayFormatted}</h2>
                    
                    {dayMatches
                      .filter((match) => {
                        if (!match.date) return false
                        const matchDate = new Date(match.date as string)
                        return !isNaN(matchDate.getTime())
                      })
                      .map((match) => {
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
                        
                        // Safely extract team relationship
                        const team = (match.team && typeof match.team === 'object' && match.team !== null && 
                                     typeof match.team.slug === 'string' && typeof match.team.name === 'string')
                          ? match.team 
                          : null
                        
                        // Calculate the actual match status based on date
                        const displayStatus = getMatchStatus(
                          match.date as string,
                          (match.status as 'scheduled' | 'cancelled') || 'scheduled'
                        )

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
                          
                          if (normalizedBeforeVs === normalizedTeamName || 
                              normalizedBeforeVs === `elmt ${normalizedTeamName}` ||
                              normalizedBeforeVs.includes(normalizedTeamName)) {
                            // Make the ELMT team name a link
                            return (
                              <span>
                                <Link 
                                  href={`/teams/${team.slug}`}
                                  className="text-primary hover:underline"
                                >
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
                        
                        return (
                        <div
                          key={match.id}
                          className="p-8 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all"
                        >
                          {/* Header with Team Logos and Status */}
                          <div className="flex items-center justify-between gap-6 mb-6">
                            {/* ELMT Team Logo */}
                            {team && team.logo && (
                              <div className="flex items-center gap-4">
                                <div className="relative w-16 h-16 rounded-lg bg-gradient-to-br from-white/10 to-white/5 ring-2 ring-white/20 p-2 flex-shrink-0">
                                  <TeamLogo
                                    src={team.logo}
                                    alt={`${team.name} Logo`}
                                    fill
                                    className="object-contain"
                                    sizes="64px"
                                  />
                                </div>
                                <div className="text-sm font-bold text-primary">ELMT {team.name}</div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* League Badge */}
                              {match.league && (
                                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
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

                            {/* Date & Time */}
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {formatDate(matchDate)} - {convertToEST(matchDate)}
                                {match.region === 'EMEA' ? ` / ${convertToCET(matchDate)}` : ''}
                              </span>
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
                            {(() => {
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
                                
                                const observerCaster = (oldObserver.caster && typeof oldObserver.caster === 'object' && oldObserver.caster !== null) ? oldObserver.caster : null
                                // Prioritize person relationship, then legacy name fields
                                const observerPerson = isPopulatedPerson(observerCaster?.person) ? observerCaster.person : null
                                const observerName = getPersonNameFromRelationship(observerCaster?.person) || observerCaster?.name || oldObserver.name || null
                                
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
                                      
                                      const hasSocialLinks = socialLinks.twitter || socialLinks.twitch || socialLinks.youtube || socialLinks.instagram
                                      if (!hasSocialLinks) return null
                                      
                                      return (
                                        <SocialLinks 
                                          links={socialLinks} 
                                        />
                                      )
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
                                        const staff = (entry.staff && typeof entry.staff === 'object' && entry.staff !== null) ? entry.staff : null
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
                                        const staff = (entry.staff && typeof entry.staff === 'object' && entry.staff !== null) ? entry.staff : null
                                        const name = getPersonNameFromRelationship(staff?.person) || staff?.name || entry.name || null
                                        
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
                                              
                                              const hasSocialLinks = socialLinks.twitter || socialLinks.twitch || socialLinks.youtube || socialLinks.instagram
                                              if (!hasSocialLinks) return null
                                              
                                              return (
                                                <SocialLinks 
                                                  links={socialLinks} 
                                                />
                                              )
                                            })()}
                                            {idx < arr.length - 1 && <span className="text-muted-foreground mx-1">&</span>}
                                          </div>
                                        )
                                      })}
                                  </div>
                                </div>
                              )
                            })()}

                            {/* Casters */}
                            {match.casters && match.casters.length > 0 && (
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                <Mic className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Production Staff: </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {match.casters
                                      .filter((casterEntry: any) => {
                                        // Filter out entries with no name
                                        if (typeof casterEntry === 'string') return true
                                        const caster = (casterEntry.caster && typeof casterEntry.caster === 'object' && casterEntry.caster !== null) ? casterEntry.caster : null
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
                                        const caster = (casterEntry.caster && typeof casterEntry.caster === 'object' && casterEntry.caster !== null) ? casterEntry.caster : null
                                        const name = getPersonNameFromRelationship(caster?.person) || caster?.name || casterEntry.name || null
                                      
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
                                            
                                            const hasSocialLinks = socialLinks.twitter || socialLinks.twitch || socialLinks.youtube || socialLinks.instagram
                                            if (!hasSocialLinks) return null
                                            
                                            return (
                                              <SocialLinks 
                                                links={socialLinks} 
                                              />
                                            )
                                          })()}
                                          {idx < arr.length - 1 && <span className="text-muted-foreground">&</span>}
                                        </div>
                                      )
                                    })}
                                </div>
                              </div>
                            )}

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
                            {displayStatus === 'completed' && match.score?.elmtScore !== undefined && match.score?.opponentScore !== undefined && (
                              <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/30 border border-border">
                                <span className={`text-2xl font-bold ${
                                  match.score.elmtScore > match.score.opponentScore
                                    ? 'text-green-400/90'
                                    : match.score.elmtScore < match.score.opponentScore
                                      ? 'text-red-400/90'
                                      : 'text-foreground'
                                }`}>
                                  {match.score.elmtScore}
                                </span>
                                <span className="text-muted-foreground font-medium">-</span>
                                <span className={`text-2xl font-bold ${
                                  match.score.opponentScore > match.score.elmtScore
                                    ? 'text-green-400/90'
                                    : match.score.opponentScore < match.score.elmtScore
                                      ? 'text-red-400/90'
                                      : 'text-foreground'
                                }`}>
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
                      )
                    })}
                  </div>
                )
              })}
          </div>
          )}
        </div>
        )}

        {/* Show message when search returns no results in either section */}
        {searchQuery && matches.docs.length === 0 && filteredPastMatches.docs.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No matches found</h3>
            <p className="text-muted-foreground mb-4">
              No matches found for "<span className="font-semibold">{searchQuery}</span>"
            </p>
            <p className="text-sm text-muted-foreground">
              Try searching for a team name, opponent, region, or league
            </p>
          </div>
        )}

        {/* Past Matches Section */}
        {filteredPastMatches.docs.length > 0 && (
          <div>
            {/* Separator - only show if there's content above */}
            {(!searchQuery || matches.docs.length > 0) && (
            <div className="relative my-12">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-4 text-sm text-muted-foreground">Match History</span>
              </div>
            </div>
            )}

            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <div className="w-2 h-8 bg-muted rounded-full" />
              Past Matches
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({pastMatches.totalDocs})
              </span>
            </h2>

            <div className="space-y-4">
              {filteredPastMatches.docs
                .filter((match) => {
                  if (!match.date) return false
                  const matchDate = new Date(match.date as string)
                  return !isNaN(matchDate.getTime())
                })
                .map((match) => {
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
                  const team = (match.team && typeof match.team === 'object' && match.team !== null && 
                               typeof match.team.slug === 'string' && typeof match.team.name === 'string')
                    ? match.team 
                    : null
                  
                  const displayStatus = getMatchStatus(
                    match.date as string,
                    (match.status as 'scheduled' | 'cancelled') || 'scheduled'
                  )

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
                    
                    if (normalizedBeforeVs === normalizedTeamName || 
                        normalizedBeforeVs === `elmt ${normalizedTeamName}` ||
                        normalizedBeforeVs.includes(normalizedTeamName)) {
                      return (
                        <span>
                          <Link 
                            href={`/teams/${team.slug}`}
                            className="text-primary hover:underline"
                          >
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
                      key={match.id}
                      className="p-6 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/20 hover:shadow-lg transition-all"
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
                          <span className={`text-xl font-bold ${
                            match.score.elmtScore! > match.score.opponentScore!
                              ? 'text-green-400/90'
                              : match.score.elmtScore! < match.score.opponentScore!
                                ? 'text-red-400/90'
                                : 'text-foreground'
                          }`}>
                            {match.score.elmtScore}
                          </span>
                          <span className="text-muted-foreground font-medium">-</span>
                          <span className={`text-xl font-bold ${
                            match.score.opponentScore! > match.score.elmtScore!
                              ? 'text-green-400/90'
                              : match.score.opponentScore! < match.score.elmtScore!
                                ? 'text-red-400/90'
                                : 'text-foreground'
                          }`}>
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
                          <span className="text-muted-foreground">
                            {formatDate(matchDate)}
                          </span>
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
                })}
            </div>

            {/* Pagination Controls */}
            {pastMatches.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {/* Previous Button */}
                <Link
                  href={`/matches${currentPage > 1 ? `?page=${currentPage - 1}` : ''}`}
                  className={`
                    flex items-center gap-1 px-4 py-2 rounded-lg border transition-colors
                    ${currentPage === 1 
                      ? 'border-border bg-card/30 text-muted-foreground cursor-not-allowed pointer-events-none' 
                      : 'border-border bg-card hover:bg-card/80 text-foreground'
                    }
                  `}
                  aria-disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Link>

                {/* Page Numbers */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: pastMatches.totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      // Show first page, last page, current page, and pages around current
                      if (pageNum === 1 || pageNum === pastMatches.totalPages) return true
                      if (Math.abs(pageNum - currentPage) <= 1) return true
                      return false
                    })
                    .map((pageNum, idx, array) => {
                      // Add ellipsis if there's a gap
                      const prevPageNum = array[idx - 1]
                      const showEllipsis = prevPageNum && pageNum - prevPageNum > 1

                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsis && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Link
                            href={`/matches${pageNum === 1 ? '' : `?page=${pageNum}`}`}
                            className={`
                              w-10 h-10 flex items-center justify-center rounded-lg border transition-colors
                              ${pageNum === currentPage
                                ? 'border-primary bg-primary text-primary-foreground font-semibold'
                                : 'border-border bg-card hover:bg-card/80 text-foreground'
                              }
                            `}
                            aria-current={pageNum === currentPage ? 'page' : undefined}
                          >
                            {pageNum}
                          </Link>
                        </React.Fragment>
                      )
                    })}
                </div>

                {/* Next Button */}
                <Link
                  href={`/matches?page=${currentPage + 1}`}
                  className={`
                    flex items-center gap-1 px-4 py-2 rounded-lg border transition-colors
                    ${currentPage === pastMatches.totalPages
                      ? 'border-border bg-card/30 text-muted-foreground cursor-not-allowed pointer-events-none'
                      : 'border-border bg-card hover:bg-card/80 text-foreground'
                    }
                  `}
                  aria-disabled={currentPage === pastMatches.totalPages}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Match Count Info */}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing {filteredPastMatches.docs.length} of {pastMatches.totalDocs} past matches
              {searchQuery && ` (filtered)`}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

