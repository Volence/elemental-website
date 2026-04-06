'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { Swords, Briefcase, Clapperboard } from 'lucide-react'

/**
 * Sidebar component showing a person's team and staff positions
 * Helps quickly identify who a person is and their roles
 */
const PersonRelationshipsSidebar: React.FC = () => {
  const { id } = useDocumentInfo()
  const [relationships, setRelationships] = React.useState<{
    teams: Array<{ teamId: number; teamName: string; role: string }>
    orgStaff: Array<{ position: string }>
    prodStaff: Array<{ position: string }>
  }>({ teams: [], orgStaff: [], prodStaff: [] })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchRelationships = async () => {
      if (!id) return

      try {
        // Fetch all teams with depth 1 so we can check roster/subs person IDs
        const teamsRes = await fetch(`/api/teams?limit=100&depth=1`)
        const teamsData = await teamsRes.json()

        // Fetch organization staff (depth 0 to get role field)
        const orgStaffRes = await fetch(`/api/organization-staff?where[person][equals]=${id}&limit=100&depth=0`)
        const orgStaffData = await orgStaffRes.json()

        // Fetch production staff (depth 0 to get role field)
        const prodStaffRes = await fetch(`/api/production?where[person][equals]=${id}&limit=100&depth=0`)
        const prodStaffData = await prodStaffRes.json()

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

        // Helper function to format production type labels
        const formatProductionType = (type: string): string => {
          const typeMap: Record<string, string> = {
            'caster': 'Caster',
            'observer': 'Observer',
            'producer': 'Producer',
            'observer-producer': 'Observer/Producer',
            'caster-observer': 'Caster/Observer',
            'caster-producer': 'Caster/Producer',
          }
          return typeMap[type] || type
        }

        // Helper function to format organization role labels
        const formatOrgRole = (role: string): string => {
          const roleMap: Record<string, string> = {
            'owner': 'Owner',
            'co-owner': 'Co-Owner',
            'hr': 'HR',
            'moderator': 'Moderator',
            'manager': 'Manager',
            'staff': 'Staff',
            'event-manager': 'Event Manager',
            'tournament-organizer': 'Tournament Organizer',
            'community-manager': 'Community Manager',
          }
          return roleMap[role] || role
        }

        // Process organization staff roles
        const orgStaffList: Array<{ position: string }> = []
        for (const staff of orgStaffData.docs || []) {
          if (staff.roles && Array.isArray(staff.roles)) {
            staff.roles.forEach((role: string) => {
              orgStaffList.push({ position: formatOrgRole(role) })
            })
          }
        }

        // Process production staff
        const prodStaffList: Array<{ position: string }> = (prodStaffData.docs || []).map((s: any) => ({
          position: formatProductionType(s.type || 'Production'),
        }))

        setRelationships({
          teams: teamRoles,
          orgStaff: orgStaffList,
          prodStaff: prodStaffList,
        })
        setLoading(false)
      } catch (error) {
        console.error('Error fetching relationships:', error)
        setLoading(false)
      }
    }

    fetchRelationships()
  }, [id])

  if (loading) {
    return (
      <div className="admin-card--compact">
        <p className="admin-text--small admin-text--muted">Loading relationships...</p>
      </div>
    )
  }

  const hasAnyRelationships = 
    relationships.teams.length > 0 || 
    relationships.orgStaff.length > 0 || 
    relationships.prodStaff.length > 0

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

      {relationships.teams.length > 0 && (
        <div className="person-relationships__section">
          <p className="person-relationships__label person-relationships__label--teams">
            <Swords size={10} className="person-relationships__label-icon" /> Teams
          </p>
          {relationships.teams.map((team, idx) => (
            <div key={idx} className="person-relationships__team-card">
              <a
                href={`/admin/collections/teams/${team.teamId}`}
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

      {relationships.orgStaff.length > 0 && (
        <div className="person-relationships__section">
          <p className="person-relationships__label person-relationships__label--org">
            <Briefcase size={10} className="person-relationships__label-icon" /> Organization Staff
          </p>
          {relationships.orgStaff.map((staff, idx) => (
            <div key={idx} className="admin-badge--warning person-relationships__staff-card">
              <p className="admin-text--small person-relationships__staff-name person-relationships__staff-name--org">
                {staff.position}
              </p>
            </div>
          ))}
        </div>
      )}

      {relationships.prodStaff.length > 0 && (
        <div className="person-relationships__section">
          <p className="person-relationships__label person-relationships__label--prod">
            <Clapperboard size={10} className="person-relationships__label-icon" /> Production Staff
          </p>
          {relationships.prodStaff.map((staff, idx) => (
            <div key={idx} className="admin-badge person-relationships__staff-card">
              <p className="admin-text--small person-relationships__staff-name person-relationships__staff-name--prod">
                {staff.position}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PersonRelationshipsSidebar
