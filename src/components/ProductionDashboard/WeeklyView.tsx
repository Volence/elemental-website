'use client'

import React, { useState, useEffect } from 'react'
import { Button, toast } from '@payloadcms/ui'

interface Team {
  id: number
  name: string
  region?: string
}

interface Match {
  id: number
  title: string
  matchType: string
  // Legacy field (backwards compatibility)
  team: any
  // New flexible team fields
  team1Type?: 'internal' | 'external'
  team1Internal?: any
  team1External?: string
  team2Type?: 'internal' | 'external'
  team2Internal?: any
  team2External?: string
  isTournamentSlot?: boolean
  opponent: string
  date: string
  region: string
  league: string
  faceitLobby?: string
  productionWorkflow?: {
    priority: string
    coverageStatus: string
    isArchived: boolean
  }
}

// Helper to get team name from new or legacy fields
const getTeam1Name = (match: Match): string => {
  // First try new flexible fields
  if (match.team1Type === 'internal' && match.team1Internal) {
    return match.team1Internal.name || 'ELMT Team'
  }
  if (match.team1Type === 'external' && match.team1External) {
    return match.team1External
  }
  // Fallback to legacy field
  if (match.team?.name) {
    return match.team.name
  }
  // Tournament slot without team assigned
  if (match.isTournamentSlot) {
    return '🎯 Tournament Slot'
  }
  return 'TBD'
}

export function WeeklyView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filterRegion, setFilterRegion] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [editingValues, setEditingValues] = useState<Record<string, any>>({})
  const updateTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    fetchMatches()
    fetchTeams()
  }, [showArchived])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams?limit=500&sort=name')
      const data = await response.json()
      setTeams(data.docs || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const fetchMatches = async () => {
    try {
      setLoading(true)
      // Fetch matches from current week onwards
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      let query = `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&where[status][not_equals]=complete&sort=date&limit=100&depth=2`
      
      if (!showArchived) {
        query += `&where[productionWorkflow.isArchived][not_equals]=true`
      }
      
      const response = await fetch(query)
      const data = await response.json()
      setMatches(data.docs || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncTournamentTeams = async () => {
    try {
      setGenerating(true)
      const response = await fetch('/api/production/sync-tournament-teams', {
        method: 'POST',
      })
      
      if (response.ok) {
        const result = await response.json()
        toast.success(`Synced ${result.syncedCount} team-tournament relationships`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to sync teams')
      }
    } catch (error) {
      console.error('Error syncing teams:', error)
      toast.error('Error syncing teams. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const generateWeeklyMatches = async () => {
    try {
      setGenerating(true)
      const response = await fetch('/api/production/generate-matches', {
        method: 'POST',
      })
      
      if (response.ok) {
        const result = await response.json()
        toast.success(`Created ${result.createdCount} matches, archived ${result.archivedCount} old matches`)
        await fetchMatches()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to generate matches')
      }
    } catch (error) {
      console.error('Error generating matches:', error)
      toast.error('Error generating matches. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const addManualMatch = () => {
    // Navigate to create new match
    window.location.href = '/admin/collections/matches/create'
  }

  // Immediate update for team selection (no debounce needed)
  const updateTeamField = async (
    matchId: number, 
    teamNum: 1 | 2, 
    type: 'internal' | 'external', 
    value: number | string | null
  ) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return

      // Build update data
      const updateData: any = {}
      
      if (teamNum === 1) {
        updateData.team1Type = type
        if (type === 'internal') {
          updateData.team1Internal = value
          updateData.team1External = null
        } else {
          updateData.team1Internal = null
          updateData.team1External = value
        }
      } else {
        updateData.team2Type = type
        if (type === 'internal') {
          updateData.team2Internal = value
          updateData.team2External = null
        } else {
          updateData.team2Internal = null
          updateData.team2External = value
        }
        // Also update legacy opponent field for backwards compatibility
        if (type === 'external') {
          updateData.opponent = value
        } else {
          const selectedTeam = teams.find(t => t.id === value)
          updateData.opponent = selectedTeam?.name || ''
        }
      }

      // Update title based on team changes
      const team1Name = teamNum === 1 
        ? (type === 'internal' ? teams.find(t => t.id === value)?.name : value as string) || 'TBD'
        : (match.team1Internal?.name || match.team1External || match.team?.name || 'TBD')
      const team2Name = teamNum === 2
        ? (type === 'internal' ? teams.find(t => t.id === value)?.name : value as string) || 'TBD'
        : (match.opponent || 'TBD')
      updateData.title = `${team1Name} vs ${team2Name}`

      // Update local state immediately
      setMatches(prevMatches =>
        prevMatches.map(m => {
          if (m.id !== matchId) return m
          if (teamNum === 1) {
            const selectedTeam = type === 'internal' ? teams.find(t => t.id === value) : undefined
            return {
              ...m,
              team1Type: type,
              team1Internal: selectedTeam,
              team1External: type === 'external' ? (value as string) : undefined,
            }
          } else {
            const selectedTeam = type === 'internal' ? teams.find(t => t.id === value) : undefined
            return {
              ...m,
              team2Type: type,
              team2Internal: selectedTeam,
              team2External: type === 'external' ? (value as string) : undefined,
              opponent: type === 'external' ? (value as string) : selectedTeam?.name || '',
            }
          }
        })
      )

      await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      toast.success(teamNum === 1 ? 'Team 1 updated' : 'Opponent updated')
    } catch (error) {
      console.error('Error updating team:', error)
      toast.error('Failed to update team')
    }
  }

  // Toggle team type between internal and external
  const toggleTeamType = (matchId: number, teamNum: 1 | 2) => {
    const match = matches.find(m => m.id === matchId)
    if (!match) return
    
    const currentType = teamNum === 1 ? match.team1Type : match.team2Type
    const newType = currentType === 'internal' ? 'external' : 'internal'
    
    // Preserve data when toggling: convert internal team to external name, or vice versa
    let newValue: number | string | null = null
    
    if (newType === 'external') {
      // Switching to external: use team name as text
      if (teamNum === 1 && match.team1Internal) {
        newValue = match.team1Internal.name || ''
      } else if (teamNum === 2 && match.team2Internal) {
        newValue = match.team2Internal.name || ''
      } else if (teamNum === 2) {
        newValue = match.opponent || ''
      }
    } else {
      // Switching to internal: try to find matching team by name
      const externalName = teamNum === 1 ? match.team1External : (match.team2External || match.opponent)
      if (externalName) {
        const matchingTeam = teams.find(t => 
          t.name.toLowerCase() === externalName.toLowerCase()
        )
        newValue = matchingTeam?.id || null
      }
    }
    
    updateTeamField(matchId, teamNum, newType, newValue)
  }

  const updateMatchField = async (matchId: number, field: string, value: any) => {
    const key = `${matchId}-${field}`
    
    // Update local state immediately for responsive UI
    setEditingValues(prev => ({ ...prev, [key]: value }))
    
    // Also update the matches array immediately for dropdowns/selects
    setMatches(prevMatches => 
      prevMatches.map(match => {
        if (match.id !== matchId) return match
        
        // Handle nested productionWorkflow field
        if (field === 'productionWorkflow') {
          return { ...match, productionWorkflow: value }
        }
        
        // Handle regular fields
        return { ...match, [field]: value }
      })
    )
    
    // Clear existing timeout
    if (updateTimeouts.current[key]) {
      clearTimeout(updateTimeouts.current[key])
    }
    
    // Debounce the actual API call (wait 1 second after user stops typing)
    updateTimeouts.current[key] = setTimeout(async () => {
      try {
        const match = matches.find(m => m.id === matchId)
        const updateData: any = { [field]: value }
        
        // Smart title update: Auto-update title when opponent changes IF:
        // 1. Opponent was TBD/empty OR
        // 2. Match is standard type (not showmatch/special) OR  
        // 3. Title follows standard "X vs Y" pattern
        if (field === 'opponent' && match) {
          const oldOpponent = match.opponent || ''
          const isOldOpponentTBD = !oldOpponent || oldOpponent.toLowerCase().includes('tbd')
          const isStandardType = !match.matchType || match.matchType === 'regular' || match.matchType === 'league'
          const followsStandardPattern = match.title && match.title.includes(' vs ')
          
          if (isOldOpponentTBD || isStandardType || followsStandardPattern) {
            const teamName = match.team?.name || 'Team'
            updateData.title = `${teamName} vs ${value}`
          }
        }
        
        await fetch(`/api/matches/${matchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })
        toast.success('Match updated')
        
        // Refresh match data to get updated title
        if (updateData.title) {
          await fetchMatches()
        }
      } catch (error) {
        console.error('Error updating match:', error)
        toast.error('Failed to update match')
      }
    }, 1000)
  }

  const getCoverageIcon = (status?: string) => {
    switch (status) {
      case 'full': return '✅'
      case 'partial': return '⚠️'
      default: return '❌'
    }
  }

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '🔴 Urgent'
      case 'high': return '⬆ High'
      case 'medium': return '↗ Medium'
      case 'low': return '→ Low'
      default: return '-'
    }
  }

  // Filter matches
  const filteredMatches = matches.filter(match => {
    if (filterRegion !== 'all' && match.region !== filterRegion) return false
    if (filterPriority !== 'all' && match.productionWorkflow?.priority !== filterPriority) return false
    return true
  })

  // Group by team for team matches
  // Include matches with matchType='team-match' OR no matchType (older matches before schema change)
  const teamMatches = filteredMatches.filter(m => m.matchType === 'team-match' || !m.matchType)
  const orgEvents = filteredMatches.filter(m => m.matchType && m.matchType !== 'team-match')

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  return (
    <div className="production-dashboard__weekly">
      <div className="production-dashboard__header">
        <div style={{ flex: 1 }}>
          <h2>Weekly View</h2>
          <p className="production-dashboard__subtitle">
            View and edit all matches for this week
          </p>
          <div className="production-dashboard__timezone-notice">
            🌍 <strong>Timezone Info:</strong> All times are automatically shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </div>
          <div className="production-dashboard__instructions">
            <strong>Quick Start:</strong>
            <ol>
              <li>If you just bulk-assigned teams, click "Sync Tournament Teams" first</li>
              <li>Click "Generate This Week's Matches" to auto-create matches from tournament templates</li>
              <li>Edit opponent names and lobby codes directly in the table</li>
              <li>Set priority levels for matches</li>
              <li>Click "Edit" to open the full match page for staff signups</li>
            </ol>
          </div>
        </div>
        <div className="production-dashboard__actions">
          <Button onClick={addManualMatch}>
            ➕ Add Match
          </Button>
          <Button onClick={syncTournamentTeams} disabled={generating}>
            {generating ? 'Syncing...' : '🔗 Sync Tournament Teams'}
          </Button>
          <Button onClick={generateWeeklyMatches} disabled={generating}>
            {generating ? 'Generating...' : '🔄 Generate This Week\'s Matches'}
          </Button>
        </div>
      </div>

      <div className="production-dashboard__filters">
        <label>
          Region:
          <select 
            className="production-dashboard__filter-select"
            value={filterRegion} 
            onChange={(e) => setFilterRegion(e.target.value)}
          >
            <option value="all">All Regions</option>
            <option value="NA">North America</option>
            <option value="EMEA">EMEA</option>
            <option value="SA">South America</option>
          </select>
        </label>
        <label>
          Priority:
          <select 
            className="production-dashboard__filter-select"
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={showArchived} 
            onChange={(e) => setShowArchived(e.target.checked)} 
          />
          Show Archived
        </label>
      </div>

      <section className="production-dashboard__section">
        <h3>Team Matches ({teamMatches.length})</h3>
        {teamMatches.length === 0 ? (
          <p className="production-dashboard__empty">No team matches found. Click "Generate This Week's Matches" to create them.</p>
        ) : (
          <div className="production-dashboard__table-wrapper">
            <table className="production-dashboard__table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Region</th>
                  <th>Division</th>
                  <th>Date/Time</th>
                  <th>Opponent</th>
                  <th>Lobby Code</th>
                  <th>Priority</th>
                  <th>Coverage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamMatches.map((match) => {
                  const opponentKey = `${match.id}-opponent`
                  const lobbyKey = `${match.id}-faceitLobby`
                  return (
                    <tr key={match.id}>
                      <td className="production-dashboard__team-cell">
                        {/* Team 1: Toggle + Dropdown/Input */}
                        <div className="production-dashboard__team-editor">
                          <button
                            className={`production-dashboard__type-toggle ${match.team1Type === 'external' ? 'production-dashboard__type-toggle--external' : ''}`}
                            onClick={() => toggleTeamType(match.id, 1)}
                            title={match.team1Type === 'external' ? 'Switch to ELMT Team' : 'Switch to External Team'}
                          >
                            {match.team1Type === 'external' ? 'Other' : 'ELMT'}
                          </button>
                          {match.team1Type === 'external' ? (
                            <input
                              type="text"
                              value={match.team1External || ''}
                              onChange={(e) => updateTeamField(match.id, 1, 'external', e.target.value)}
                              className="production-dashboard__inline-input"
                              placeholder="Team name"
                            />
                          ) : (
                            <select
                              value={match.team1Internal?.id || ''}
                              onChange={(e) => updateTeamField(match.id, 1, 'internal', e.target.value ? parseInt(e.target.value) : null)}
                              className="production-dashboard__inline-input"
                            >
                              <option value="">Select team...</option>
                              {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td>{match.region}</td>
                      <td>{match.league}</td>
                      <td>{new Date(match.date).toLocaleString()}</td>
                      <td className="production-dashboard__team-cell">
                        {/* Team 2 / Opponent: Toggle + Dropdown/Input */}
                        <div className="production-dashboard__team-editor">
                          <button
                            className={`production-dashboard__type-toggle ${match.team2Type === 'internal' ? '' : 'production-dashboard__type-toggle--external'}`}
                            onClick={() => toggleTeamType(match.id, 2)}
                            title={match.team2Type === 'internal' ? 'Switch to External Team' : 'Switch to ELMT Team'}
                          >
                            {match.team2Type === 'internal' ? 'ELMT' : 'Other'}
                          </button>
                          {match.team2Type === 'internal' ? (
                            <select
                              value={match.team2Internal?.id || ''}
                              onChange={(e) => updateTeamField(match.id, 2, 'internal', e.target.value ? parseInt(e.target.value) : null)}
                              className="production-dashboard__inline-input"
                            >
                              <option value="">Select team...</option>
                              {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={match.opponent || ''}
                              onChange={(e) => updateTeamField(match.id, 2, 'external', e.target.value)}
                              className="production-dashboard__inline-input"
                              placeholder="Opponent name"
                            />
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editingValues[lobbyKey] ?? match.faceitLobby ?? ''}
                          onChange={(e) => updateMatchField(match.id, 'faceitLobby', e.target.value)}
                          className="production-dashboard__inline-input"
                          placeholder="FACEIT lobby URL"
                        />
                      </td>
                      <td>
                        <select
                          value={match.productionWorkflow?.priority || 'none'}
                          onChange={(e) => updateMatchField(match.id, 'productionWorkflow', {
                            ...match.productionWorkflow,
                            priority: e.target.value
                          })}
                          className="production-dashboard__inline-select"
                        >
                          <option value="none">None</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </td>
                      <td>
                        {getCoverageIcon(match.productionWorkflow?.coverageStatus)}
                      </td>
                      <td>
                        <a href={`/admin/collections/matches/${match.id}`} target="_blank" rel="noopener noreferrer">
                          Edit
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="production-dashboard__section">
        <h3>Organization Events ({orgEvents.length})</h3>
        {orgEvents.length === 0 ? (
          <p className="production-dashboard__empty">No organization events scheduled.</p>
        ) : (
          <div className="production-dashboard__table-wrapper">
            <table className="production-dashboard__table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Type</th>
                  <th>Date/Time</th>
                  <th>Coverage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgEvents.map((match) => (
                  <tr key={match.id}>
                    <td>{match.title}</td>
                    <td>{match.matchType}</td>
                    <td>{new Date(match.date).toLocaleString()}</td>
                    <td>
                      {getCoverageIcon(match.productionWorkflow?.coverageStatus)}
                    </td>
                    <td>
                      <a href={`/admin/collections/matches/${match.id}`} target="_blank" rel="noopener noreferrer">
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

