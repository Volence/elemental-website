'use client'

import React, { useState, useEffect } from 'react'
import { Button, toast } from '@payloadcms/ui'

interface Match {
  id: number
  title: string
  matchType: string
  team: any
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

export function WeeklyView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filterRegion, setFilterRegion] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [editingValues, setEditingValues] = useState<Record<string, any>>({})
  const updateTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    fetchMatches()
  }, [showArchived])

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
  const teamMatches = filteredMatches.filter(m => m.matchType === 'team-match')
  const orgEvents = filteredMatches.filter(m => m.matchType !== 'team-match')

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
                      <td>{match.team?.name || 'Unknown Team'}</td>
                      <td>{match.region}</td>
                      <td>{match.league}</td>
                      <td>{new Date(match.date).toLocaleString()}</td>
                      <td>
                        <input
                          type="text"
                          value={editingValues[opponentKey] ?? match.opponent ?? ''}
                          onChange={(e) => updateMatchField(match.id, 'opponent', e.target.value)}
                          className="production-dashboard__inline-input"
                          placeholder="Opponent name"
                        />
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

