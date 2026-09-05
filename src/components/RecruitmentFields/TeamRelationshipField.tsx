'use client'

import React, { useEffect, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { useAccess } from '@/access/useAccess'

export const TeamRelationshipField: React.FC<any> = (props) => {
  const { access } = useAccess()
  const { value, setValue } = useField({ path: props.path })
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!access) return
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams?limit=100')
        const data = await response.json()

        let filteredTeams = data.docs || []

        // Team-scoped (non-staff) people can only see their own teams
        if (!access.canManagePeople && access.teamIds.size > 0) {
          filteredTeams = filteredTeams.filter((team: any) => access.teamIds.has(Number(team.id)))
        }

        setTeams(filteredTeams)
      } catch (error) {
        console.error('Error fetching teams:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [access])

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
        style={{
          width: '100%',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--elmt-radius-sm)',
          border: '1px solid var(--elmt-border-default)',
          background: 'var(--elmt-bg-elevated)',
          color: 'var(--elmt-text-primary)',
        }}
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

