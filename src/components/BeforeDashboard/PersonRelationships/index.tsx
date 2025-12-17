'use client'

import React, { useEffect, useState } from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'

/**
 * Component that displays all teams and staff positions a person is associated with
 * Shows on the People edit page
 */
const PersonRelationships: React.FC = () => {
  const pathname = usePathname()
  const docInfo = useDocumentInfo()
  const form = useForm()
  
  // Try multiple ways to get the ID
  const id = docInfo?.id || 
             (docInfo as any)?.document?.id || 
             (pathname?.match(/\/people\/(\d+)/)?.[1])
  const [relationships, setRelationships] = useState<{
    teams: Array<{ id: number; name: string; roles: string[] }>
    orgStaff: Array<{ id: number; roles: string[] }>
    production: Array<{ id: number; type: string }>
  }>({ teams: [], orgStaff: [], production: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    const fetchRelationships = async () => {
      try {
        // Fetch all teams and check if this person is in them
        const teamsResponse = await fetch(`/api/teams?limit=1000`, {
          credentials: 'include',
        })
        const teamsData = teamsResponse.ok ? await teamsResponse.json() : { docs: [] }

        const personTeams: Array<{ id: number; name: string; roles: string[] }> = []

        teamsData.docs.forEach((team: any) => {
          const roles: string[] = []

          // Check managers
          if (team.manager?.some((m: any) => {
            const personId = typeof m.person === 'number' ? m.person : m.person?.id
            return personId === Number(id)
          })) {
            roles.push('Manager')
          }

          // Check coaches
          if (team.coaches?.some((c: any) => {
            const personId = typeof c.person === 'number' ? c.person : c.person?.id
            return personId === Number(id)
          })) {
            roles.push('Coach')
          }

          // Check captains
          if (team.captain?.some((cap: any) => {
            const personId = typeof cap.person === 'number' ? cap.person : cap.person?.id
            return personId === Number(id)
          })) {
            roles.push('Captain')
          }

          // Check co-captain
          if (team.coCaptain) {
            const coCapId = typeof team.coCaptain === 'number' ? team.coCaptain : team.coCaptain?.id
            if (coCapId === Number(id)) {
              roles.push('Co-Captain')
            }
          }

          // Check roster
          if (team.roster?.some((r: any) => {
            const personId = typeof r.person === 'number' ? r.person : r.person?.id
            return personId === Number(id)
          })) {
            const rosterEntry = team.roster.find((r: any) => {
              const personId = typeof r.person === 'number' ? r.person : r.person?.id
              return personId === Number(id)
            })
            roles.push(`Roster (${rosterEntry?.role || 'Unknown'})`)
          }

          // Check subs
          if (team.subs?.some((s: any) => {
            const personId = typeof s.person === 'number' ? s.person : s.person?.id
            return personId === Number(id)
          })) {
            roles.push('Substitute')
          }

          if (roles.length > 0) {
            personTeams.push({ id: team.id, name: team.name, roles })
          }
        })

        // Fetch organization staff
        const orgStaffResponse = await fetch(`/api/organization-staff?limit=1000`, {
          credentials: 'include',
        })
        const orgStaffData = orgStaffResponse.ok ? await orgStaffResponse.json() : { docs: [] }

        const personOrgStaff: Array<{ id: number; roles: string[] }> = []
        orgStaffData.docs.forEach((staff: any) => {
          const personId = typeof staff.person === 'number' ? staff.person : staff.person?.id
          if (personId === Number(id) && staff.roles?.length > 0) {
            personOrgStaff.push({ id: staff.id, roles: staff.roles })
          }
        })

        // Fetch production staff
        const productionResponse = await fetch(`/api/production?limit=1000`, {
          credentials: 'include',
        })
        const productionData = productionResponse.ok ? await productionResponse.json() : { docs: [] }

        const personProduction: Array<{ id: number; type: string }> = []
        productionData.docs.forEach((prod: any) => {
          const personId = typeof prod.person === 'number' ? prod.person : prod.person?.id
          if (personId === Number(id)) {
            personProduction.push({ id: prod.id, type: prod.type || 'Unknown' })
          }
        })

        setRelationships({
          teams: personTeams,
          orgStaff: personOrgStaff,
          production: personProduction,
        })
      } catch (error) {
        console.error('[PersonRelationships] Error fetching relationships:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRelationships()
  }, [id])

  if (loading || !id) return null

  const totalRelationships = relationships.teams.length + relationships.orgStaff.length + relationships.production.length
  if (totalRelationships === 0) return null

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5ZM9 4.5C10.2426 4.5 11.25 5.50736 11.25 6.75C11.25 7.99264 10.2426 9 9 9C7.75736 9 6.75 7.99264 6.75 6.75C6.75 5.50736 7.75736 4.5 9 4.5ZM4.5 13.05C4.5 11.085 6.085 9.5 8.05 9.5H9.95C11.915 9.5 13.5 11.085 13.5 13.05V13.5H4.5V13.05Z"
            fill="var(--theme-text-600)"
          />
        </svg>
        <strong style={{ color: 'var(--theme-text)', fontSize: '0.95rem' }}>
          Associated Teams & Staff Positions
        </strong>
      </div>

      {relationships.teams.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--theme-text-700)', marginBottom: '0.5rem' }}>
            Teams ({relationships.teams.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {relationships.teams.map((team) => (
              <div key={team.id} style={{ paddingLeft: '1rem' }}>
                <a
                  href={`/admin/collections/teams/${team.id}`}
                  style={{
                    color: 'var(--theme-success-600)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                >
                  {team.name}
                </a>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--theme-text-500)' }}>
                  ({team.roles.join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relationships.orgStaff.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--theme-text-700)', marginBottom: '0.5rem' }}>
            Organization Staff ({relationships.orgStaff.length}):
          </div>
          <div style={{ paddingLeft: '1rem', fontSize: '0.875rem', color: 'var(--theme-text-600)' }}>
            {relationships.orgStaff.map((staff, idx) => (
              <div key={staff.id}>
                <a
                  href={`/admin/collections/organization-staff/${staff.id}`}
                  style={{
                    color: 'var(--theme-success-600)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                >
                  Staff Entry #{staff.id}
                </a>
                <span style={{ marginLeft: '0.5rem', color: 'var(--theme-text-500)' }}>
                  ({staff.roles.join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relationships.production.length > 0 && (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--theme-text-700)', marginBottom: '0.5rem' }}>
            Production Staff ({relationships.production.length}):
          </div>
          <div style={{ paddingLeft: '1rem', fontSize: '0.875rem', color: 'var(--theme-text-600)' }}>
            {relationships.production.map((prod) => (
              <div key={prod.id}>
                <a
                  href={`/admin/collections/production/${prod.id}`}
                  style={{
                    color: 'var(--theme-success-600)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                >
                  {prod.type}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonRelationships
