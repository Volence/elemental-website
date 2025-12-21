'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'
import { GradientBorder } from '../GradientBorder'

/**
 * Component that displays assigned teams on the dashboard page
 * Shows clickable team cards for Team Managers to quickly navigate to their teams
 */
const AssignedTeamsDashboard: React.FC = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  const [assignedTeams, setAssignedTeams] = useState<Array<{ id: number; name: string; slug?: string; logo?: string }>>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    
    // @ts-ignore - Payload ClientUser type compatibility issue
    const currentUser = user as User
    
    // Only show for Admins, Team Managers, and Staff Managers on the dashboard page
    const canShowDashboard = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_MANAGER || currentUser.role === UserRole.STAFF_MANAGER
    if (!canShowDashboard) {
      setLoading(false)
      return
    }
    
    // Only show on dashboard page
    if (pathname !== '/admin' && pathname !== '/admin/') {
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
            setAssignedTeams(teams.map((team: any) => ({ 
              id: team.id, 
              name: team.name,
              slug: team.slug,
              logo: team.logo
            })))
            setLoading(false)
            return
          }
        }
        
        // Fallback: try to get names from the user object if populated
        const teams = userAssignedTeams
          .filter((team: any) => typeof team === 'object' && team !== null && team.name)
          .map((team: any) => ({ 
            id: team.id || team, 
            name: team.name,
            slug: team.slug 
          }))
        
        if (teams.length > 0) {
          setAssignedTeams(teams.map((team: any) => ({ 
            id: team.id || team, 
            name: team.name,
            slug: team.slug,
            logo: team.logo
          })))
        } else {
          // Last resort: just show IDs
          setAssignedTeams(teamIds.map(id => ({ id, name: `Team ${id}` })))
        }
      } catch (error) {
        console.error('[AssignedTeamsDashboard] Error fetching teams:', error)
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
  
  // Only show for Admins, Team Managers, and Staff Managers on dashboard page
  const canShowDashboard = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_MANAGER || currentUser.role === UserRole.STAFF_MANAGER
  if (!canShowDashboard) {
    return null
  }
  
  if (pathname !== '/admin' && pathname !== '/admin/') {
    return null
  }
  
  if (assignedTeams.length === 0) {
    return null
  }
  
  return (
    <GradientBorder>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
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
            fill="var(--theme-success-500)"
          />
        </svg>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1rem', 
          fontWeight: 600,
          color: 'var(--theme-text)'
        }}>
          Your Assigned Teams
        </h3>
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '0.75rem'
      }}>
        {assignedTeams.map((team) => (
          <a
            key={team.id}
            href={`/admin/collections/teams/${team.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.125rem',
              minHeight: '56px',
              backgroundColor: 'var(--theme-elevation-100, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--theme-elevation-200, rgba(255, 255, 255, 0.1))',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'var(--theme-text)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-elevation-200, rgba(255, 255, 255, 0.1))'
              e.currentTarget.style.borderColor = 'var(--theme-success-500)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100, rgba(255, 255, 255, 0.05))'
              e.currentTarget.style.borderColor = 'var(--theme-elevation-200, rgba(255, 255, 255, 0.1))'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: 'var(--theme-elevation-200)',
                border: '1px solid var(--theme-elevation-300)',
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
            <span style={{ fontSize: '0.9rem', flex: 1 }}>{team.name}</span>
          </a>
        ))}
      </div>
    </GradientBorder>
  )
}

export default AssignedTeamsDashboard




