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
      <div style={{
        padding: '1rem 1.5rem',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.5rem' }}>✅</span>
        <div>
          <div style={{ 
            fontWeight: '600', 
            color: 'var(--theme-text)',
            marginBottom: '0.25rem' 
          }}>
            All Clear!
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--theme-elevation-700)' 
          }}>
            No teams are using inactive leagues. Everything is up to date.
          </div>
        </div>
      </div>
    )
  }

  // Show warnings for teams on inactive leagues
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {inactiveLeagueWarnings.map((warning) => (
        <div
          key={warning.league.id}
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: '600', 
                color: 'var(--theme-text)',
                marginBottom: '0.5rem',
                fontSize: '1rem'
              }}>
                {warning.teamCount} {warning.teamCount === 1 ? 'team is' : 'teams are'} still using inactive league: "{warning.league.name}"
              </div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: 'var(--theme-elevation-700)',
                marginBottom: '0.75rem'
              }}>
                These teams won't receive new data updates until they're moved to an active league.
              </div>
              
              {/* Team List */}
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ 
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--theme-text)',
                  padding: '0.5rem',
                  backgroundColor: 'var(--theme-elevation-100)',
                  borderRadius: '0.25rem',
                  display: 'inline-block',
                }}>
                  View Teams ({warning.teamCount})
                </summary>
                <div style={{ 
                  marginTop: '0.75rem',
                  display: 'grid',
                  gap: '0.5rem',
                  paddingLeft: '1rem'
                }}>
                  {warning.teams.map((team: any) => (
                    <a
                      key={team.id}
                      href={`/admin/collections/teams/${team.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: 'var(--theme-elevation-100)',
                        borderRadius: '0.25rem',
                        textDecoration: 'none',
                        color: 'var(--theme-text)',
                        fontSize: '0.875rem',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--theme-elevation-200)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
                      }}
                    >
                      <span>→</span>
                      <span style={{ fontWeight: '500' }}>{team.name}</span>
                      <span style={{ 
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        color: 'var(--theme-elevation-600)',
                      }}>
                        Update →
                      </span>
                    </a>
                  ))}
                </div>
              </details>
              
              {/* Action Hint */}
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: 'var(--theme-elevation-100)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                color: 'var(--theme-elevation-700)',
              }}>
                <strong>To fix:</strong> Click on each team above and select an active league from the "Current FaceIt League" dropdown.
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FaceitLeaguesNotifications



