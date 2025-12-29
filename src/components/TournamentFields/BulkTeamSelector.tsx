'use client'

import React, { useState, useEffect } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'

interface Team {
  id: number
  name: string
  region: string
  rating?: string
  status?: string
  faceitEnabled?: boolean
  currentFaceitLeague?: number | { id: number }
}

const BulkTeamSelector: React.FC<any> = ({ path }) => {
  const { value, setValue } = useField<number[]>({ path })
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  
  // Get FaceIt-related form fields
  const isFaceitTournament = useFormFields(([fields]) => fields.isFaceitTournament)
  const faceitAutoSync = useFormFields(([fields]) => fields.faceitAutoSync)
  const faceitLeague = useFormFields(([fields]) => fields.faceitLeague)

  useEffect(() => {
    fetchTeams()
  }, [isFaceitTournament?.value, faceitAutoSync?.value, faceitLeague?.value])

  const fetchTeams = async () => {
    try {
      setLoading(true)
      
      // Build query parameters for smart filtering
      let url = '/api/teams?limit=1000&depth=1'
      
      // If FaceIt tournament with auto-sync, filter to FaceIt-enabled teams
      if (isFaceitTournament?.value && faceitAutoSync?.value) {
        url += '&where[faceitEnabled][equals]=true'
        
        // If specific league selected, filter to teams in that league
        if (faceitLeague?.value) {
          url += `&where[currentFaceitLeague][equals]=${faceitLeague.value}`
        }
      }
      
      const response = await fetch(url)
      const data = await response.json()
      setTeams(data.docs || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const selectedIds = value || []

  const handleToggle = (teamId: number) => {
    const newValue = selectedIds.includes(teamId)
      ? selectedIds.filter(id => id !== teamId)
      : [...selectedIds, teamId]
    setValue(newValue)
  }

  const handleSelectAll = () => {
    const filteredTeamIds = getFilteredTeams().map(t => t.id)
    setValue(filteredTeamIds)
  }

  const handleDeselectAll = () => {
    setValue([])
  }

  const getDivisionFromRating = (rating?: string): string => {
    if (!rating) return 'Open'
    // Extract division name from rating (e.g., "FACEIT Masters" -> "Masters")
    if (rating.includes('Masters')) return 'Masters'
    if (rating.includes('Expert')) return 'Expert'
    if (rating.includes('Advanced')) return 'Advanced'
    // Default to Open for anything else (including explicit "Open" or unknown divisions)
    return 'Open'
  }

  const getFilteredTeams = (): Team[] => {
    return teams.filter(team => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        team.name.toLowerCase().includes(searchTerm.toLowerCase())

      // Region filter
      const matchesRegion = regionFilter === 'all' || team.region === regionFilter

      // Division filter
      const teamDivision = getDivisionFromRating(team.rating)
      const matchesDivision = divisionFilter === 'all' || teamDivision === divisionFilter

      return matchesSearch && matchesRegion && matchesDivision
    })
  }

  const filteredTeams = getFilteredTeams()
  const allFilteredSelected = filteredTeams.length > 0 && 
    filteredTeams.every(team => selectedIds.includes(team.id))

  if (loading) {
    return <div className="bulk-team-selector__loading">Loading teams...</div>
  }

  return (
    <div className="bulk-team-selector">
      <div className="bulk-team-selector__header">
        <h4 className="bulk-team-selector__title">📋 Bulk Team Selection</h4>
        <p className="bulk-team-selector__subtitle">
          Select multiple teams at once to assign to this tournament
        </p>
        {(isFaceitTournament?.value as boolean) && (faceitAutoSync?.value as boolean) && (
          <div style={{ 
            marginTop: '0.75rem', 
            padding: '0.75rem', 
            backgroundColor: 'var(--theme-elevation-200)', 
            borderRadius: '4px',
            border: '1px solid var(--theme-elevation-400)'
          }}>
            <strong>🎯 Smart Filtering Active:</strong>{' '}
            {faceitLeague?.value ? (
              <span>Only showing teams in the selected FaceIt league</span>
            ) : (
              <span>Only showing FaceIt-enabled teams</span>
            )}
          </div>
        )}
      </div>

      <div className="bulk-team-selector__filters">
        <input
          type="text"
          placeholder="🔍 Search teams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bulk-team-selector__search"
        />

        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="bulk-team-selector__filter"
        >
          <option value="all">All Regions</option>
          <option value="NA">North America</option>
          <option value="EMEA">EMEA</option>
          <option value="SA">South America</option>
        </select>

        <select
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value)}
          className="bulk-team-selector__filter"
        >
          <option value="all">All Divisions</option>
          <option value="Masters">Masters</option>
          <option value="Expert">Expert</option>
          <option value="Advanced">Advanced</option>
          <option value="Open">Open</option>
        </select>
      </div>

      <div className="bulk-team-selector__actions">
        <button
          type="button"
          onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
          className="bulk-team-selector__action-btn"
        >
          {allFilteredSelected ? '❌ Deselect All' : '✅ Select All Filtered'}
        </button>
        <span className="bulk-team-selector__count">
          {selectedIds.length} team{selectedIds.length !== 1 ? 's' : ''} selected
        </span>
      </div>

      <div className="bulk-team-selector__list">
        {filteredTeams.length === 0 ? (
          <div className="bulk-team-selector__empty">
            No teams match your filters
          </div>
        ) : (
          filteredTeams.map(team => {
            const isSelected = selectedIds.includes(team.id)
            const division = getDivisionFromRating(team.rating)

            return (
              <label
                key={team.id}
                className={`bulk-team-selector__item ${isSelected ? 'bulk-team-selector__item--selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(team.id)}
                  className="bulk-team-selector__checkbox"
                />
                <div className="bulk-team-selector__team-info">
                  <span className="bulk-team-selector__team-name">{team.name}</span>
                  <div className="bulk-team-selector__team-meta">
                    <span className="bulk-team-selector__badge bulk-team-selector__badge--region">
                      {team.region}
                    </span>
                    <span className="bulk-team-selector__badge bulk-team-selector__badge--division">
                      {division}
                    </span>
                    {team.status && (
                      <span className={`bulk-team-selector__badge bulk-team-selector__badge--status bulk-team-selector__badge--${team.status}`}>
                        {team.status}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

export default BulkTeamSelector

