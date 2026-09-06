'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { Swords, Briefcase, Clapperboard } from 'lucide-react'
import { titlesOf, type TitledPerson } from '@/utilities/staffFromTitles'
import { TITLE_BY_VALUE } from '@/access/titles'

/**
 * Sidebar component showing a person's team and staff positions.
 * Helps quickly identify who a person is and their roles.
 * Staff positions come straight from the loaded person's `titles` field (already on the
 * document - no separate fetch); only team membership still needs its own request.
 */
const PersonRelationshipsSidebar: React.FC = () => {
  const { id, data } = useDocumentInfo()
  const [teams, setTeams] = React.useState<Array<{ teamId: number; teamName: string; role: string }>>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchTeams = async () => {
      if (!id) return

      try {
        // Fetch all teams with depth 1 so we can check roster/subs person IDs
        const teamsRes = await fetch(`/api/teams?limit=100&depth=1`)
        const teamsData = await teamsRes.json()

        // Process teams to determine roles
        const teamRoles: Array<{ teamId: number; teamName: string; role: string }> = []
        for (const team of teamsData.docs || []) {
          const roles: string[] = []

          // Check roster (array of {person, role} objects)
          if (team.roster && Array.isArray(team.roster)) {
            const rosterRoles: string[] = []
            team.roster.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) {
                const roleLabel = item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'Player'
                rosterRoles.push(roleLabel)
              }
            })
            if (rosterRoles.length > 0) {
              roles.push(...rosterRoles)
            }
          }

          // Check subs
          if (team.subs && Array.isArray(team.subs)) {
            team.subs.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) {
                roles.push('Substitute')
              }
            })
          }

          // Check captain
          if (team.captain && Array.isArray(team.captain)) {
            team.captain.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) {
                roles.push('Captain')
              }
            })
          }

          // Check coaches
          if (team.coaches && Array.isArray(team.coaches)) {
            team.coaches.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) {
                roles.push('Coach')
              }
            })
          }

          // Check manager
          if (team.manager && Array.isArray(team.manager)) {
            team.manager.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) {
                roles.push('Manager')
              }
            })
          }

          // Check coCaptain
          if (team.coCaptain) {
            if (Array.isArray(team.coCaptain)) {
              team.coCaptain.forEach((item: any) => {
                const personId = typeof item.person === 'object' ? item.person?.id : item.person
                if (personId == id) {
                  roles.push('Co-Captain')
                }
              })
            } else {
              const coCaptainId = typeof team.coCaptain === 'object' ? team.coCaptain?.id : team.coCaptain
              if (coCaptainId == id) {
                roles.push('Co-Captain')
              }
            }
          }

          if (roles.length > 0) {
            teamRoles.push({
              teamId: team.id,
              teamName: team.name,
              role: roles.join(', '),
            })
          }
        }

        setTeams(teamRoles)
      } catch (error) {
        console.error('Error fetching relationships:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [id])

  // Titles are already on the loaded document - split into the same two sections the old
  // organization-staff / production collections used to populate.
  const titles = titlesOf((data ?? {}) as TitledPerson)
  const orgStaff = titles.filter((t) => {
    const group = TITLE_BY_VALUE[t.title].group
    return group === 'organization' || group === 'department'
  })
  const prodStaff = titles.filter((t) => TITLE_BY_VALUE[t.title].group === 'production')

  if (loading) {
    return (
      <div className="admin-card--compact">
        <p className="admin-text--small admin-text--muted">Loading relationships...</p>
      </div>
    )
  }

  const hasAnyRelationships = teams.length > 0 || orgStaff.length > 0 || prodStaff.length > 0

  if (!hasAnyRelationships) {
    return (
      <div className="admin-card--compact">
        <h4 className="admin-text--small person-relationships__title--empty">
          Relationships
        </h4>
        <p className="admin-text--small admin-text--muted">
          No teams or staff positions
        </p>
      </div>
    )
  }

  return (
    <div className="person-relationships admin-card--compact">
      <h4 className="person-relationships__title">
        Relationships
      </h4>

      {teams.length > 0 && (
        <div className="person-relationships__section">
          <p className="person-relationships__label person-relationships__label--teams">
            <Swords size={10} className="person-relationships__label-icon" /> Teams
          </p>
          {teams.map((team, idx) => (
            <div key={idx} className="person-relationships__team-card">
              <a
                href={`/admin/edit-team?id=${team.teamId}`}
                className="person-relationships__team-link"
              >
                {team.teamName} →
              </a>
              <p className="person-relationships__team-role">
                {team.role}
              </p>
            </div>
          ))}
        </div>
      )}

      {orgStaff.length > 0 && (
        <div className="person-relationships__section">
          <p className="person-relationships__label person-relationships__label--org">
            <Briefcase size={10} className="person-relationships__label-icon" /> Organization Staff
          </p>
          {orgStaff.map((t, idx) => (
            <div key={idx} className="admin-badge--warning person-relationships__staff-card">
              <p className="admin-text--small person-relationships__staff-name person-relationships__staff-name--org">
                {t.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {prodStaff.length > 0 && (
        <div className="person-relationships__section">
          <p className="person-relationships__label person-relationships__label--prod">
            <Clapperboard size={10} className="person-relationships__label-icon" /> Production Staff
          </p>
          {prodStaff.map((t, idx) => (
            <div key={idx} className="admin-badge person-relationships__staff-card">
              <p className="admin-text--small person-relationships__staff-name person-relationships__staff-name--prod">
                {t.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PersonRelationshipsSidebar
