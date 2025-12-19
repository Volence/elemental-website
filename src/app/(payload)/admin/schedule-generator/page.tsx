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
    streamedBy?: string
  }
  faceitLobby?: string
  producersObservers?: Array<{
    staff?: any
    name?: string
  }>
  casters?: Array<{
    caster?: any
    name?: string
  }>
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
        `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&sort=date&limit=50&depth=3`
      )
      const data = await response.json()
      
      // Debug: Log the first match to see data structure
      if (data.docs && data.docs.length > 0) {
        console.log('First match data structure:', JSON.stringify(data.docs[0], null, 2))
      }
      
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

  const formatDateWithOrdinal = (dateString: string) => {
    const date = new Date(dateString)
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
    const month = date.toLocaleDateString('en-US', { month: 'long' })
    const day = date.getDate()
    
    // Add ordinal suffix (st, nd, rd, th)
    const ordinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd']
      const v = n % 100
      return n + (s[(v - 20) % 10] || s[v] || s[0])
    }
    
    return `${weekday} ${month} ${ordinal(day)}`
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

  const formatTimeCET24 = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
      hour12: false,
    }).replace(/^0/, '') // Remove leading zero
  }

  const formatTimeEST12 = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      hour12: true,
    }).toLowerCase()
  }

  const getPersonName = (person: any): string => {
    if (!person) return ''
    if (typeof person === 'object' && person.name) return person.name
    return String(person)
  }

  const getProducersObservers = (match: Match): string[] => {
    if (!match.producersObservers) return []
    return match.producersObservers
      .map((po, idx) => {
        // Debug logging
        console.log(`Producer/Observer ${idx}:`, po)
        
        // First check if there's a manual name
        if (po.name && typeof po.name === 'string' && po.name.trim()) {
          console.log(`  -> Using manual name: ${po.name}`)
          return po.name
        }
        
        // Then check if staff relationship is populated
        if (po.staff) {
          console.log(`  -> Staff object:`, po.staff)
          if (typeof po.staff === 'object') {
            // Check for displayName (computed field in Production collection)
            if (po.staff.displayName && typeof po.staff.displayName === 'string') {
              console.log(`  -> Using staff.displayName: ${po.staff.displayName}`)
              return po.staff.displayName
            }
            
            // Check if person relationship is populated
            if (po.staff.person) {
              console.log(`  -> Person object:`, po.staff.person)
              if (typeof po.staff.person === 'object' && po.staff.person.name) {
                console.log(`  -> Using staff.person.name: ${po.staff.person.name}`)
                return po.staff.person.name
              }
            }
          }
        }
        console.log(`  -> No name found`)
        return null
      })
      .filter(Boolean) as string[]
  }

  const getCasterNames = (match: Match): string[] => {
    if (!match.casters) return []
    return match.casters
      .map((c, idx) => {
        // Debug logging
        console.log(`Caster ${idx}:`, c)
        
        // First check if there's a manual name
        if (c.name && typeof c.name === 'string' && c.name.trim()) {
          console.log(`  -> Using manual name: ${c.name}`)
          return c.name
        }
        
        // Then check if caster relationship is populated
        if (c.caster) {
          console.log(`  -> Caster object:`, c.caster)
          if (typeof c.caster === 'object') {
            // Check for displayName (computed field in Production collection)
            if (c.caster.displayName && typeof c.caster.displayName === 'string') {
              console.log(`  -> Using caster.displayName: ${c.caster.displayName}`)
              return c.caster.displayName
            }
            
            // Check if person relationship is populated
            if (c.caster.person) {
              console.log(`  -> Person object:`, c.caster.person)
              if (typeof c.caster.person === 'object' && c.caster.person.name) {
                console.log(`  -> Using caster.person.name: ${c.caster.person.name}`)
                return c.caster.person.name
              }
            }
          }
        }
        console.log(`  -> No name found`)
        return null
      })
      .filter(Boolean) as string[]
  }

  const getDiscordTimestamp = (dateString: string, format: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'F'): string => {
    const timestamp = Math.floor(new Date(dateString).getTime() / 1000)
    return `<t:${timestamp}:${format}>`
  }

  const generateInternalSchedule = () => {
    let output = ''
    
    matches.forEach((match, index) => {
      const teamName = typeof match.team === 'object' ? match.team?.name : ''
      const title = match.title || `ELMT ${teamName} vs ${match.opponent}`
      
      // Date and time with Discord timestamp for automatic timezone conversion
      const discordTimestamp = getDiscordTimestamp(match.date, 'F')
      output += `${discordTimestamp}:\n\n`
      
      // Title
      output += `${title}\n`
      
      // FACEIT Lobby
      if (match.faceitLobby) {
        output += `FACEIT Lobby: ${match.faceitLobby}\n\n`
      } else {
        output += `FACEIT Lobby: TBD\n\n`
      }

      // Get production staff
      const observers = getProducersObservers(match)
      const casters = getCasterNames(match)
      
      // Observer/Producer
      if (observers.length > 0) {
        output += `Observer: ${observers.join(' ')}\n`
      } else {
        output += `Observer: TBD\n`
      }

      // Casters
      if (casters.length > 0) {
        output += `Casters: ${casters.join(' ')}\n`
      } else {
        output += `Casters: TBD\n`
      }

      // Separator
      output += '\n' + '-'.repeat(72) + '\n\n'
    })

    return output
  }

  const getTeamEmoji = (teamName: string) => {
    // Map team names to their custom Discord emoji codes
    // You can customize these in Discord by right-clicking the emoji and copying the emoji ID
    const emojiMap: Record<string, string> = {
      'Fire': '<:fire:1427018330358681710>',
      'Heaven': '<:heaven:1427024742900174898>',
      // Add more teams as needed
    }
    return emojiMap[teamName] || '🔥' // Default to fire emoji if not found
  }

  const generatePublicAnnouncement = () => {
    let output = '📺 **This Week\'s ELMT Broadcast Schedule**\n\n'
    output += '━'.repeat(47) + '\n'

    matches.forEach((match, index) => {
      const teamName = typeof match.team === 'object' ? match.team?.name : ''
      const title = match.title || `ELMT ${teamName} vs ${match.opponent}`
      
      // Get team-specific emoji
      const teamEmoji = getTeamEmoji(teamName)
      
      output += `## ${teamEmoji} **${title}**\n`
      
      // Region and division
      const region = match.region || 'TBD'
      const league = match.league || 'Open'
      const season = match.season || 'S7 Regular Season'
      output += `🌍 ${region} / ${league} • ${season}\n`
      
      // Time with Discord timestamp (automatically adjusts to user's timezone)
      const discordTimestamp = getDiscordTimestamp(match.date, 'F')
      output += `🕒 ${discordTimestamp}\n`
      
      // Stream
      if (match.stream?.url) {
        output += `🎥 Stream: ${match.stream.url}\n`
      } else {
        output += `🎥 Stream: https://twitch.tv/elmt_gg\n`
      }

      // Observer
      const observers = getProducersObservers(match)
      if (observers.length > 0) {
        output += `👁️ Observer: ${observers.join(', ')}\n`
      } else {
        output += `👁️ Observer: TBD\n`
      }

      // Casters
      const casters = getCasterNames(match)
      if (casters.length > 0) {
        output += `🎤 Casters: ${casters.join(' & ')}\n`
      } else {
        output += `🎤 Casters: TBD\n`
      }

      // FACEIT Lobby
      if (match.faceitLobby) {
        output += `🔗 FACEIT Lobby: ${match.faceitLobby}\n`
      } else {
        output += `🔗 FACEIT Lobby: TBD\n`
      }

      output += '━'.repeat(47) + '\n'
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



