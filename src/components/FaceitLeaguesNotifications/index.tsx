'use client'

import React, { useState, useEffect } from 'react'

/**
 * Notifications banner for FaceIt Leagues list page
 * Shows warnings about inactive leagues still being used by teams
 */
const FaceitLeaguesNotifications: React.FC = () => {
  const [inactiveLeagueWarnings, setInactiveLeagueWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWarnings()
  }, [])

  const fetchWarnings = async () => {
    try {
      setLoading(true)
      
      // Fetch all leagues
      const leaguesRes = await fetch('/api/faceit-leagues?limit=100')
      const leaguesData = await leaguesRes.json()
      const inactiveLeagues = leaguesData.docs.filter((l: any) => !l.isActive)
      
      // For each inactive league, check how many teams are using it
      const warnings = []
      for (const league of inactiveLeagues) {
        const teamsRes = await fetch(`/api/teams?where[currentFaceitLeague][equals]=${league.id}&limit=100`)
        const teamsData = await teamsRes.json()
        
        if (teamsData.docs.length > 0) {
          warnings.push({
            league: league,
            teamCount: teamsData.totalDocs,
            teams: teamsData.docs,
          })
        }
      }
      
      setInactiveLeagueWarnings(warnings)
    } catch (error) {
      console.error('Error fetching FaceIt league warnings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null // Don't show anything while loading
  }

  if (inactiveLeagueWarnings.length === 0) {
    // No warnings - show success message
    return (
      <div className="faceit-notifications__badge faceit-notifications__badge--success">
        <span className="faceit-notifications__icon">✅</span>
        <span>All Clear! No teams are using inactive leagues. Everything is up to date.</span>
      </div>
    )
  }

  // Show warnings for teams on inactive leagues
  return (
    <div className="faceit-notifications">
      {inactiveLeagueWarnings.map((warning) => (
        <div
          key={warning.league.id}
          className="faceit-notifications__banner faceit-notifications__banner--warning"
        >
          <span className="faceit-notifications__icon">⚠️</span>
          <div className="faceit-notifications__content">
            <div className="faceit-notifications__title">
              {warning.teamCount} {warning.teamCount === 1 ? 'team is' : 'teams are'} still using inactive league: "{warning.league.name}"
            </div>
            <div className="faceit-notifications__description">
              These teams won't receive new data updates until they're moved to an active league.
            </div>
            
            {/* Team List */}
            <details className="faceit-notifications__details">
              <summary>
                View Teams ({warning.teamCount})
              </summary>
              <div className="faceit-notifications__teams-list">
                {warning.teams.map((team: any) => (
                  <a
                    key={team.id}
                    href={`/admin/collections/teams/${team.id}`}
                    className="faceit-notifications__team-link"
                  >
                    <span>→</span>
                    <span className="faceit-notifications__team-link-name">{team.name}</span>
                    <span className="faceit-notifications__team-link-action">
                      Update →
                    </span>
                  </a>
                ))}
              </div>
            </details>
            
            {/* Action Hint */}
            <div className="faceit-notifications__hint">
              <strong>To fix:</strong> Click on each team above and select an active league from the "Current FaceIt League" dropdown.
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FaceitLeaguesNotifications



