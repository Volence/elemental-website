'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, useField } from '@payloadcms/ui'
import { UserRole } from '@/access/roles'

export const TeamRelationshipField: React.FC<any> = (props) => {
  const { user } = useAuth()
  const { value, setValue } = useField({ path: props.path })
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams?limit=100')
        const data = await response.json()
        
        let filteredTeams = data.docs || []
        
        // Team managers can only see their assigned teams
        if (user?.role === UserRole.TEAM_MANAGER) {
          const assignedTeams = user.assignedTeams
          if (assignedTeams && Array.isArray(assignedTeams)) {
            const teamIds = assignedTeams.map((team: any) =>
              typeof team === 'number' ? team : team?.id || team,
            )
            filteredTeams = filteredTeams.filter((team: any) => teamIds.includes(team.id))
          } else {
            filteredTeams = []
          }
        }
        
        setTeams(filteredTeams)
      } catch (error) {
        console.error('Error fetching teams:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [user])

  if (loading) {
    return <div>Loading teams...</div>
  }

  return (
    <div className="field-type relationship">
      <label htmlFor={props.path} className="field-label">
        {props.field.label || props.field.name}
        {props.field.required && <span className="required">*</span>}
      </label>
      {props.field.admin?.description && (
        <div className="field-description">{props.field.admin.description}</div>
      )}
      <select
        id={props.path}
        value={value as string || ''}
        onChange={(e) => setValue(e.target.value ? Number(e.target.value) : null)}
        required={props.field.required}
        className="w-full rounded border border-gray-600 bg-gray-700 px-4 py-2 text-white"
      >
        <option value="">Select a team</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export default TeamRelationshipField

