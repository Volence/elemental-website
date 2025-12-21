'use client'

import React, { useEffect, useState } from 'react'
import { getPeopleListData } from '@/utilities/peopleListDataCache'

/**
 * Custom cell component that displays all teams a person is associated with
 * Shows in the People list view
 * 
 * OPTIMIZED: Uses shared data cache instead of fetching per-row
 */
const TeamsCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const [teams, setTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const findPersonTeams = async () => {
      if (!rowData?.id) {
        setLoading(false)
        return
      }

      try {
        // Use cached data instead of fetching!
        const { teams: allTeams } = await getPeopleListData()
        const personId = Number(rowData.id)
        const associatedTeams: string[] = []

        // Check each team for this person
        allTeams.forEach((team: any) => {
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
        console.error('[TeamsCell] Error finding teams:', error)
      } finally {
        setLoading(false)
      }
    }

    findPersonTeams()
  }, [rowData?.id])

  if (loading) {
    return <span className="list-cell-loading">Loading...</span>
  }

  if (teams.length === 0) {
    return <span className="list-cell-empty">—</span>
  }

  return (
    <div className="list-cell-tags">
      {teams.map((team, idx) => (
        <span key={idx} className="list-cell-tag list-cell-tag--team">
          {team}
        </span>
      ))}
    </div>
  )
}

export default TeamsCell
