'use client'

import React, { useEffect, useState } from 'react'

/**
 * Custom cell component that displays all teams a person is associated with
 * Shows in the People list view
 */
const TeamsCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const [teams, setTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeams = async () => {
      if (!rowData?.id) {
        setLoading(false)
        return
      }

      try {
        // Fetch all teams and filter by person
        const response = await fetch(`/api/teams?limit=1000&depth=0`, {
          credentials: 'include',
        })
        
        if (!response.ok) {
          setLoading(false)
          return
        }

        const data = await response.json()
        const personId = Number(rowData.id)
        const associatedTeams: string[] = []

        // Check each team for this person
        data.docs?.forEach((team: any) => {
          let isInTeam = false

          // Check manager
          if (team.manager?.some((m: any) => {
            const pid = typeof m.person === 'number' ? m.person : m.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check coaches
          if (team.coaches?.some((c: any) => {
            const pid = typeof c.person === 'number' ? c.person : c.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check captain
          if (team.captain?.some((cap: any) => {
            const pid = typeof cap.person === 'number' ? cap.person : cap.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check roster
          if (team.roster?.some((r: any) => {
            const pid = typeof r.person === 'number' ? r.person : r.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check subs
          if (team.subs?.some((s: any) => {
            const pid = typeof s.person === 'number' ? s.person : s.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          if (isInTeam && team.name) {
            associatedTeams.push(team.name)
          }
        })

        setTeams(associatedTeams)
      } catch (error) {
        console.error('[TeamsCell] Error fetching teams:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [rowData?.id])

  if (loading) {
    return <span style={{ color: 'var(--theme-text-500)', fontSize: '0.875rem' }}>Loading...</span>
  }

  if (teams.length === 0) {
    return <span style={{ color: 'var(--theme-text-500)', fontSize: '0.875rem' }}>—</span>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '300px' }}>
      {teams.map((team, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-block',
            padding: '0.125rem 0.5rem',
            backgroundColor: 'var(--theme-elevation-100)',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--theme-text)',
            whiteSpace: 'nowrap',
          }}
        >
          {team}
        </span>
      ))}
    </div>
  )
}

export default TeamsCell
