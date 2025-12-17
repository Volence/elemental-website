'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Component that displays assigned teams at the top of the Teams list page
 * Only shows for Team Managers to highlight which teams they can edit
 */
const AssignedTeamsBanner: React.FC = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  const [assignedTeams, setAssignedTeams] = useState<Array<{ id: number; name: string; logo?: string }>>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    
    // @ts-ignore - Payload ClientUser type compatibility issue
    const currentUser = user as User
    
    // Only show for Admins, Team Managers, and Staff Managers on the Teams page
    const canShowBanner = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_MANAGER || currentUser.role === UserRole.STAFF_MANAGER
    if (!canShowBanner || !pathname?.includes('/teams')) {
      setLoading(false)
      return
    }
    
    // Fetch assigned teams with their names
    const fetchAssignedTeams = async () => {
      try {
        const userAssignedTeams = currentUser.assignedTeams
        if (!userAssignedTeams || !Array.isArray(userAssignedTeams) || userAssignedTeams.length === 0) {
          setAssignedTeams([])
          setLoading(false)
          return
        }
        
        // Extract team IDs
        const teamIds = userAssignedTeams.map((team: any) => 
          typeof team === 'number' ? team : (team?.id || team)
        ).filter((id): id is number => typeof id === 'number')
        
        if (teamIds.length === 0) {
          setAssignedTeams([])
          setLoading(false)
          return
        }
        
        // Fetch team details to get names using Payload API
        const response = await fetch(`/api/teams?where[id][in]=${teamIds.join(',')}&limit=100`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          const teams = data.docs || []
          if (teams.length > 0) {
            setAssignedTeams(teams.map((team: any) => ({ id: team.id, name: team.name, logo: team.logo })))
            setLoading(false)
            return
          }
        }
        
        // Fallback: try to get names from the user object if populated
        {
          // Fallback: try to get names from the user object if populated
          const teams = userAssignedTeams
            .filter((team: any) => typeof team === 'object' && team !== null && team.name)
            .map((team: any) => ({ id: team.id || team, name: team.name }))
          
          if (teams.length > 0) {
            setAssignedTeams(teams.map((team: any) => ({ id: team.id || team, name: team.name, logo: team.logo })))
          } else {
            // Last resort: just show IDs
            setAssignedTeams(teamIds.map(id => ({ id, name: `Team ${id}` })))
          }
        }
      } catch (error) {
        console.error('[AssignedTeamsBanner] Error fetching teams:', error)
        // Fallback to showing IDs
        const userAssignedTeams = currentUser.assignedTeams
        if (userAssignedTeams && Array.isArray(userAssignedTeams)) {
          const teamIds = userAssignedTeams.map((team: any) => 
            typeof team === 'number' ? team : (team?.id || team)
          ).filter((id): id is number => typeof id === 'number')
          setAssignedTeams(teamIds.map(id => ({ id, name: `Team ${id}` })))
        }
      } finally {
        setLoading(false)
      }
    }
    
    fetchAssignedTeams()
  }, [user, pathname])
  
  if (loading || !user) return null
  
  // @ts-ignore - Payload ClientUser type compatibility issue
  const currentUser = user as User
  
  // Only show for Admins, Team Managers, and Staff Managers on Teams page
  const canShowBanner = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_MANAGER || currentUser.role === UserRole.STAFF_MANAGER
  if (!canShowBanner || !pathname?.includes('/teams')) {
    return null
  }
  
  if (assignedTeams.length === 0) {
    return null
  }
  
  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: 'var(--theme-success-50)',
        border: '2px solid var(--theme-success-200)',
        borderRadius: '8px',
        borderLeft: '4px solid var(--theme-success-500)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM9 13L5 9L6.41 7.59L9 10.17L13.59 5.58L15 7L9 13Z"
            fill="var(--theme-success-600)"
          />
        </svg>
        <strong style={{ color: 'var(--theme-success-900)', fontSize: '0.95rem' }}>
          Your Assigned Teams
        </strong>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--theme-text-600)', fontSize: '0.875rem', marginRight: '0.25rem' }}>
          You can edit these teams:
        </span>
        {assignedTeams.map((team) => (
          <a
            key={team.id}
            href={`/admin/collections/teams/${team.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.75rem',
              minHeight: '40px',
              backgroundColor: 'var(--theme-success-100)',
              color: 'var(--theme-success-900)',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid var(--theme-success-300)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-success-200)'
              e.currentTarget.style.borderColor = 'var(--theme-success-400)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-success-100)'
              e.currentTarget.style.borderColor = 'var(--theme-success-300)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: 'var(--theme-success-50)',
                border: '1px solid var(--theme-success-300)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src={team.logo || '/logos/org.png'}
                alt={`${team.name} logo`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target.src !== '/logos/org.png') {
                    target.src = '/logos/org.png'
                  }
                }}
              />
            </div>
            {team.name}
          </a>
        ))}
      </div>
    </div>
  )
}

export default AssignedTeamsBanner
