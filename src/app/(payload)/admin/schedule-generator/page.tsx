'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@payloadcms/ui'

interface Match {
  id: number
  title: string
  team: any
  opponent: string
  date: string
  region: string
  league: string
  season?: string
  stream?: {
    url: string
    platform: string
  }
  faceitLobby?: string
  productionStaff?: {
    producers?: any[]
    casters?: any[]
  }
  dragonRoster?: any[]
}

const ScheduleGeneratorPage = () => {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedInternal, setCopiedInternal] = useState(false)
  const [copiedPublic, setCopiedPublic] = useState(false)

  useEffect(() => {
    fetchUpcomingMatches()
  }, [])

  const fetchUpcomingMatches = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const response = await fetch(
        `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&sort=date&limit=50&depth=2`
      )
      const data = await response.json()
      setMatches(data.docs || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (dateString: string, timezone: 'EST' | 'CET') => {
    const date = new Date(dateString)
    if (timezone === 'EST') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        hour12: true,
      })
    } else {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
        hour12: false,
      })
    }
  }

  const getPersonName = (person: any): string => {
    if (!person) return ''
    if (typeof person === 'object' && person.name) return person.name
    return String(person)
  }

  const generateInternalSchedule = () => {
    let output = '**This Week\'s ELMT Schedule**\n\n'
    
    matches.forEach((match, index) => {
      const teamName = typeof match.team === 'object' ? match.team?.name : ''
      const title = match.title || `ELMT ${teamName} vs ${match.opponent}`
      
      output += `${title}\n`
      
      if (match.faceitLobby) {
        output += `Faceit Lobby: ${match.faceitLobby}\n\n`
      } else {
        output += `Faceit Lobby: TBD\n\n`
      }

      // Observers
      const observers = match.productionStaff?.producers?.map(getPersonName).filter(Boolean) || []
      if (observers.length > 0) {
        output += `Observer: ${observers.map(name => `@${name}`).join(', ')}\n`
      } else {
        output += `Observer: TBD\n`
      }

      // Casters
      const casters = match.productionStaff?.casters?.map(getPersonName).filter(Boolean) || []
      if (casters.length > 0) {
        output += `Casters: ${casters.map(name => `@${name}`).join(' & ')}\n\n`
      } else {
        output += `Casters: TBD\n\n`
      }

      // Players (if roster data exists)
      if (match.dragonRoster && match.dragonRoster.length > 0) {
        const players = match.dragonRoster.map((player: any) => {
          const name = getPersonName(player.personId || player)
          const pronouns = player.pronouns || 'They/Them'
          return `${name} (${pronouns})`
        })
        output += `Players: ${players.join('  ')}\n`
      }

      output += '\n' + '—'.repeat(70) + '\n\n'
    })

    return output
  }

  const generatePublicAnnouncement = () => {
    let output = '📅 **This Week\'s ELMT Broadcast Schedule**\n\n'
    output += '—'.repeat(70) + '\n\n'

    matches.forEach((match, index) => {
      const teamName = typeof match.team === 'object' ? match.team?.name : ''
      const title = match.title || `ELMT ${teamName} vs ${match.opponent}`
      
      // Team emoji (you can customize these)
      const teamEmoji = '🔥'
      
      output += `${teamEmoji} **${title}**\n`
      output += `🌍 ${match.region || 'TBD'} / ${match.league || 'TBD'}`
      if (match.season) {
        output += ` • ${match.season}`
      }
      output += '\n'
      
      output += `🕐 ${formatDate(match.date)} — ${formatTime(match.date, 'CET')} CET / ${formatTime(match.date, 'EST')} EST\n`
      
      if (match.stream?.url) {
        output += `📺 Stream: ${match.stream.url}\n`
      } else {
        output += `📺 Stream: https://twitch.tv/elmt_gg\n`
      }

      const observers = match.productionStaff?.producers?.map(getPersonName).filter(Boolean) || []
      if (observers.length > 0) {
        output += `👁️ Observer: ${observers.join(', ')}\n`
      }

      const casters = match.productionStaff?.casters?.map(getPersonName).filter(Boolean) || []
      if (casters.length > 0) {
        output += `🎙️ Casters: ${casters.join(' & ')}\n`
      }

      if (match.faceitLobby) {
        output += `🔗 FACEIT Lobby: ${match.faceitLobby}\n`
      }

      output += '\n' + '—'.repeat(70) + '\n\n'
    })

    return output
  }

  const copyToClipboard = async (text: string, type: 'internal' | 'public') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'internal') {
        setCopiedInternal(true)
        setTimeout(() => setCopiedInternal(false), 2000)
      } else {
        setCopiedPublic(true)
        setTimeout(() => setCopiedPublic(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Loading matches...</p>
      </div>
    )
  }

  const internalSchedule = generateInternalSchedule()
  const publicAnnouncement = generatePublicAnnouncement()

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '2rem', fontWeight: 'bold' }}>
        📋 Schedule Generator
      </h1>
      <p style={{ marginBottom: '2rem', color: 'var(--theme-elevation-500)' }}>
        Auto-generate Discord announcements from upcoming matches. Found {matches.length} upcoming match(es).
      </p>

      {/* Internal Schedule */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            🔒 Internal Production Schedule
          </h2>
          <Button
            onClick={() => copyToClipboard(internalSchedule, 'internal')}
            buttonStyle="primary"
          >
            {copiedInternal ? '✓ Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>
        <div
          style={{
            background: 'var(--theme-elevation-100)',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '8px',
            padding: '1.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {internalSchedule}
        </div>
      </div>

      {/* Public Announcement */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            📢 Public Discord Announcement
          </h2>
          <Button
            onClick={() => copyToClipboard(publicAnnouncement, 'public')}
            buttonStyle="primary"
          >
            {copiedPublic ? '✓ Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>
        <div
          style={{
            background: 'var(--theme-elevation-100)',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '8px',
            padding: '1.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {publicAnnouncement}
        </div>
      </div>
    </div>
  )
}

export default ScheduleGeneratorPage
