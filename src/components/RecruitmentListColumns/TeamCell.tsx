'use client'

import React, { useEffect, useState } from 'react'
import type { RecruitmentListing, Team } from '@/payload-types'

interface TeamCellProps {
  rowData?: RecruitmentListing
}

export const TeamCell: React.FC<TeamCellProps> = ({ rowData }) => {
  const [teamName, setTeamName] = useState<string>('Loading...')

  useEffect(() => {
    const loadTeamName = async () => {
      // Show dash for org-wide positions (no team)
      if (rowData?.category === 'org-staff' || !rowData?.team) {
        setTeamName('—')
        return
      }

      // Check if team is already populated as an object
      if (typeof rowData.team === 'object' && 'name' in rowData.team) {
        setTeamName(rowData.team.name || 'Unknown Team')
        return
      }

      // If team is just an ID number, fetch the team data
      if (typeof rowData.team === 'number') {
        try {
          const response = await fetch(`/api/teams/${rowData.team}`)
          if (response.ok) {
            const teamData = await response.json()
            setTeamName(teamData.name || 'Unknown Team')
          } else {
            setTeamName('Unknown Team')
          }
        } catch (error) {
          console.error('Error fetching team:', error)
          setTeamName('Error')
        }
        return
      }

      setTeamName('Unknown Team')
    }

    loadTeamName()
  }, [rowData])

  return (
    <div className="list-cell">
      <span>{teamName}</span>
    </div>
  )
}

export default TeamCell

