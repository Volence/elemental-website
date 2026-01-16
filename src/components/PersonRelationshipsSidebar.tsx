'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

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
        // Note: roster and subs are arrays of objects with {person, role}, so we need to fetch with depth and filter in JS
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
              if (personId == id) { // Use == for type coercion
                // Add the specific role (Tank, DPS, Support)
                const roleLabel = item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'Player'
                rosterRoles.push(roleLabel)
              }
            })
            if (rosterRoles.length > 0) {
              roles.push(...rosterRoles)
            }
          }
          
          // Check subs (array of {person} objects)
          if (team.subs && Array.isArray(team.subs)) {
            team.subs.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) { // Use == for type coercion
                roles.push('Substitute')
              }
            })
          }
          
          // Check captain (array of {person} objects)
          if (team.captain && Array.isArray(team.captain)) {
            team.captain.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) { // Use == for type coercion
                roles.push('Captain')
              }
            })
          }
          
          // Check coaches (array of {person} objects)
          if (team.coaches && Array.isArray(team.coaches)) {
            team.coaches.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) { // Use == for type coercion
                roles.push('Coach')
              }
            })
          }
          
          // Check manager (array of {person} objects)
          if (team.manager && Array.isArray(team.manager)) {
            team.manager.forEach((item: any) => {
              const personId = typeof item.person === 'object' ? item.person?.id : item.person
              if (personId == id) { // Use == for type coercion
                roles.push('Manager')
              }
            })
          }
          
          // Check coCaptain (might be single or array)
          if (team.coCaptain) {
            if (Array.isArray(team.coCaptain)) {
              team.coCaptain.forEach((item: any) => {
                const personId = typeof item.person === 'object' ? item.person?.id : item.person
                if (personId == id) { // Use == for type coercion
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

        // Process organization staff roles (can have multiple roles per person)
        const orgStaffList: Array<{ position: string }> = []
        for (const staff of orgStaffData.docs || []) {
          if (staff.roles && Array.isArray(staff.roles)) {
            // Each role becomes a separate item for clarity
            staff.roles.forEach((role: string) => {
              orgStaffList.push({ position: formatOrgRole(role) })
            })
          }
        }

        // Process production staff (one type per person)
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
        <h4 className="admin-text--small" style={{ 
          margin: '0 0 0.5rem 0', 
          fontWeight: 600,
        }}>
          Relationships
        </h4>
        <p className="admin-text--small admin-text--muted">
          No teams or staff positions
        </p>
      </div>
    )
  }

  return (
    <div className="person-relationships-sidebar admin-card--compact">
      <h4 style={{ 
        margin: '0 0 0.75rem 0', 
        fontSize: '0.875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: 'linear-gradient(90deg, #06b6d4 0%, #84cc16 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        Relationships
      </h4>

      {relationships.teams.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ 
            margin: '0 0 0.25rem 0', 
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            opacity: 0.6,
            letterSpacing: '0.5px',
            color: 'rgb(6, 182, 212)',
          }}>
            ⚔️ Teams
          </p>
          {relationships.teams.map((team, idx) => (
            <div key={idx} style={{ 
              padding: '0.5rem',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(132, 204, 22, 0.1) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '6px',
              marginBottom: '0.25rem',
              transition: 'all 0.2s ease',
            }}>
              <a
                href={`/admin/collections/teams/${team.teamId}`}
                style={{ 
                  margin: 0, 
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'rgb(6, 182, 212)',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'rgb(132, 204, 22)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgb(6, 182, 212)'
                }}
              >
                {team.teamName} →
              </a>
              <p style={{ 
                margin: '0.125rem 0 0 0', 
                fontSize: '0.75rem',
                color: 'rgb(132, 204, 22)',
                fontWeight: 500,
              }}>
                {team.role}
              </p>
            </div>
          ))}
        </div>
      )}

      {relationships.orgStaff.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ 
            margin: '0 0 0.25rem 0', 
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            opacity: 0.6,
            letterSpacing: '0.5px',
            color: 'rgb(245, 158, 11)',
          }}>
            👔 Organization Staff
          </p>
          {relationships.orgStaff.map((staff, idx) => (
            <div key={idx} className="admin-badge--warning" style={{ 
              padding: '0.5rem',
              marginBottom: '0.25rem',
              display: 'block',
            }}>
              <p className="admin-text--small" style={{ 
                margin: 0, 
                fontWeight: 600,
                color: 'rgb(245, 158, 11)',
              }}>
                {staff.position}
              </p>
            </div>
          ))}
        </div>
      )}

      {relationships.prodStaff.length > 0 && (
        <div>
          <p style={{ 
            margin: '0 0 0.25rem 0', 
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            opacity: 0.6,
            letterSpacing: '0.5px',
            color: 'rgb(99, 102, 241)',
          }}>
            🎬 Production Staff
          </p>
          {relationships.prodStaff.map((staff, idx) => (
            <div key={idx} className="admin-badge" style={{ 
              padding: '0.5rem',
              marginBottom: '0.25rem',
              display: 'block',
            }}>
              <p className="admin-text--small" style={{ 
                margin: 0, 
                fontWeight: 600,
                color: 'rgb(99, 102, 241)',
              }}>
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

