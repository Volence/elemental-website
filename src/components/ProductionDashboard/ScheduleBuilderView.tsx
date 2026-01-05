'use client'

import React, { useState, useEffect } from 'react'
import { Button, toast } from '@payloadcms/ui'

interface User {
  id: number
  name?: string
  email?: string
}

interface CasterInfo {
  user: User | number
  style?: string
}

interface Match {
  id: number
  title: string
  matchType: string
  team: any
  opponent: string
  date: string
  region: string
  league: string
  stream?: {
    url?: string
  }
  productionWorkflow?: {
    coverageStatus: string
    includeInSchedule: boolean
    assignedObserver?: User | number | null
    assignedProducer?: User | number | null
    assignedCasters?: CasterInfo[]
  }
}

export function ScheduleBuilderView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedInternal, setCopiedInternal] = useState(false)
  const [copiedPublic, setCopiedPublic] = useState(false)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Fetch upcoming matches with at least partial coverage
      const query = `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&where[productionWorkflow.isArchived][not_equals]=true&where[status][not_equals]=complete&sort=date&limit=100&depth=2`

      const response = await fetch(query)
      const data = await response.json()

      // Filter to only matches with partial or full coverage
      const withCoverage = (data.docs || []).filter(
        (m: Match) => m.productionWorkflow?.coverageStatus === 'partial' || m.productionWorkflow?.coverageStatus === 'full'
      )

      setMatches(withCoverage)
    } catch (error) {
      console.error('Error fetching matches:', error)
      toast.error('Error fetching matches')
    } finally {
      setLoading(false)
    }
  }

  const toggleIncludeInSchedule = async (matchId: number, currentValue: boolean) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return

      await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionWorkflow: {
            ...match.productionWorkflow,
            includeInSchedule: !currentValue
          }
        }),
      })

      // Update local state
      setMatches(matches.map(m =>
        m.id === matchId
          ? {
              ...m,
              productionWorkflow: {
                ...m.productionWorkflow!,
                includeInSchedule: !currentValue
              }
            }
          : m
      ))

      toast.success(!currentValue ? 'Added to schedule' : 'Removed from schedule')
    } catch (error) {
      console.error('Error updating match:', error)
      toast.error('Error updating match')
    }
  }

  const getUserName = (user: User | number | null | undefined): string => {
    if (!user) return 'Unknown'
    if (typeof user === 'number') return `User #${user}`
    return user.name || user.email || 'Unknown'
  }

  const getFullTeamName = (teamName: string): string => {
    // Ensure team name has "ELMT " prefix
    // "Bug" -> "ELMT Bug", "ELMT Bug" -> "ELMT Bug"
    if (!teamName.startsWith('ELMT ')) {
      return `ELMT ${teamName}`
    }
    return teamName
  }

  const generateDiscordInternal = () => {
    const selectedMatches = matches.filter(m => m.productionWorkflow?.includeInSchedule)
    if (selectedMatches.length === 0) {
      return '**No matches selected for broadcast this week.**\n\nUse the checkboxes to select matches to include in the schedule.'
    }

    let output = ''

    selectedMatches.forEach((match, index) => {
      const pw = match.productionWorkflow!
      const teamName = getFullTeamName(match.team?.name || 'Unknown Team')
      const date = new Date(match.date)
      
      // Format date header (e.g., "Wednesday December 17th 20CET (2pm EST):")
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
      const month = date.toLocaleDateString('en-US', { month: 'long' })
      const day = date.getDate()
      const daySuffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'
      const cetTime = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris', hour12: false })
      const estTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', hour12: true }).toLowerCase()
      
      output += `${weekday} ${month} ${day}${daySuffix} ${cetTime}CET (${estTime} EST):\n\n`
      
      // Match info
      output += `${teamName} vs ${match.opponent}\n`
      
      // FACEIT Lobby (use stream URL or placeholder)
      const faceitLink = match.stream?.url || 'https://www.faceit.com/en/ow2/room/[TBD]'
      output += `FACEIT Lobby: ${faceitLink}\n\n`
      
      // Staff assignments (with @ mentions)
      const observer = pw.assignedObserver ? `@${getUserName(pw.assignedObserver as User)}` : 'TBD'
      const casters = pw.assignedCasters?.map(c => `@${getUserName(c.user as User)}`).join(' & ') || 'TBD'
      
      output += `Observer: ${observer}\n`
      output += `Casters: ${casters}\n`
      
      // Add separator if not last match
      if (index < selectedMatches.length - 1) {
        output += '\n' + '-'.repeat(80) + '\n\n'
      }
    })

    output += '\n' + '-'.repeat(80) + '\n\n'
    output += 'Schedule for the week!'

    return output
  }

  const generateDiscordPublic = () => {
    const selectedMatches = matches.filter(m => m.productionWorkflow?.includeInSchedule)
    if (selectedMatches.length === 0) {
      return '**No matches selected for broadcast this week.**'
    }

    let output = '**📺 This Week\'s ELMT Broadcast Schedule**\n'
    output += '═══════════════════════════════════\n\n'

    selectedMatches.forEach((match, index) => {
      const pw = match.productionWorkflow!
      const teamName = getFullTeamName(match.team?.name || 'Unknown Team')
      const date = new Date(match.date)
      
      // Discord timestamp (localized automatically) - format: <t:UNIX_TIMESTAMP:F>
      const unixTimestamp = Math.floor(date.getTime() / 1000)
      
      // Team and match info
      output += `🎮 **${teamName} vs ${match.opponent}**\n`
      
      // Region / Division • League
      const region = match.team?.region || match.region || 'NA'
      const division = match.team?.division || 'Expert'
      const league = match.league || 'S7 Regular Season'
      output += `🌍 ${region} / ${division} • ${league}\n`
      
      // Discord timestamp (automatically localized for each user)
      output += `🕐 <t:${unixTimestamp}:F>\n`
      
      // Casters (with Twitch links if available)
      const casters = pw.assignedCasters?.map(c => {
        const casterName = getUserName(c.user as User)
        // Placeholder for Twitch links - you'd need to add twitch username to user profile
        return `https://www.twitch.tv/${casterName.toLowerCase().replace(/\s+/g, '')}`
      }) || []
      
      if (casters.length > 0) {
        output += `🎙️ Casted by: ${casters.join(' & ')}\n`
      }
      
      // FACEIT Lobby
      const faceitLink = match.stream?.url || 'https://www.faceit.com/en/ow2/room/[TBD]'
      output += `🔗 FACEIT Lobby: ${faceitLink}\n`
      
      // Add separator if not last match
      if (index < selectedMatches.length - 1) {
        output += '\n───────────────────────────────────\n\n'
      }
    })

    return output
  }

  const copyToClipboard = (text: string, type: 'internal' | 'public') => {
    navigator.clipboard.writeText(text)
    if (type === 'internal') {
      setCopiedInternal(true)
      setTimeout(() => setCopiedInternal(false), 2000)
    } else {
      setCopiedPublic(true)
      setTimeout(() => setCopiedPublic(false), 2000)
    }
    toast.success('Copied to clipboard!')
  }

  const selectedCount = matches.filter(m => m.productionWorkflow?.includeInSchedule).length

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  return (
    <div className="production-dashboard__schedule-builder">
      <div className="production-dashboard__header">
        <div>
          <h2>Schedule Builder</h2>
          <p className="production-dashboard__subtitle">
            Select matches with coverage to broadcast. Then export to Discord.
          </p>
          <div className="production-dashboard__instructions">
            <strong>How it works:</strong>
            <ol>
              <li>Check the boxes for matches you want to broadcast</li>
              <li>Preview the Discord announcements on the right</li>
              <li>Click "Copy" to copy Internal (staff) or Public (announcements) format</li>
              <li>Paste into Discord channels</li>
            </ol>
          </div>
        </div>
        <div className="schedule-builder__stats">
          <span className="schedule-builder__stat">
            {matches.length} matches with coverage
          </span>
          <span className="schedule-builder__stat schedule-builder__stat--highlight">
            {selectedCount} selected
          </span>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="production-dashboard__empty">
          <p>No matches with coverage found.</p>
          <p>Assign staff in the Assignment tab first, then come back here to build your broadcast schedule.</p>
        </div>
      ) : (
        <div className="schedule-builder__content">
          <div className="schedule-builder__matches">
            <h3>Available Matches</h3>
            <p className="schedule-builder__instruction">
              ✅ Check matches to include in this week's broadcast schedule
            </p>

            <div className="schedule-builder__match-list">
              {matches.map((match) => {
                const pw = match.productionWorkflow!
                const isSelected = pw.includeInSchedule
                const isFull = pw.coverageStatus === 'full'

                return (
                  <div
                    key={match.id}
                    className={`schedule-builder__match ${isSelected ? 'schedule-builder__match--selected' : ''}`}
                  >
                    <label className="schedule-builder__match-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleIncludeInSchedule(match.id, isSelected)}
                        className="schedule-builder__checkbox"
                      />
                      <div className="schedule-builder__match-info">
                        <div className="schedule-builder__match-header">
                          <strong>{match.title}</strong>
                          <span className={`coverage-badge coverage-badge--${pw.coverageStatus}`}>
                            {isFull ? '✅ Full' : '⚠️ Partial'}
                          </span>
                        </div>
                        <div className="schedule-builder__match-meta">
                          <span>{new Date(match.date).toLocaleString()}</span>
                          <span>
                            {pw.assignedObserver && pw.assignedProducer ? '👁️🎬' : ''}{' '}
                            {pw.assignedCasters?.length ? `🎙️×${pw.assignedCasters.length}` : ''}
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="schedule-builder__export">
            <h3>Discord Export</h3>

            <div className="schedule-builder__preview-section">
              <div className="schedule-builder__preview-header">
                <h4>🔒 Internal (Staff Channel)</h4>
                <Button
                  onClick={() => copyToClipboard(generateDiscordInternal(), 'internal')}
                  disabled={selectedCount === 0}
                >
                  {copiedInternal ? '✓ Copied!' : '📋 Copy'}
                </Button>
              </div>
              <pre className="schedule-builder__preview">{generateDiscordInternal()}</pre>
            </div>

            <div className="schedule-builder__preview-section">
              <div className="schedule-builder__preview-header">
                <h4>📢 Public (Announcements)</h4>
                <Button
                  onClick={() => copyToClipboard(generateDiscordPublic(), 'public')}
                  disabled={selectedCount === 0}
                >
                  {copiedPublic ? '✓ Copied!' : '📋 Copy'}
                </Button>
              </div>
              <pre className="schedule-builder__preview">{generateDiscordPublic()}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
