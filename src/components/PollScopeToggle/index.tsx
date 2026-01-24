'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'

import './index.scss'

type Scope = 'my-teams' | 'all-teams'

export const PollScopeToggle: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Default to 'all-teams' for staff-managers (changed from 'my-teams')
  const [scope, setScope] = useState<Scope>('all-teams')
  const [isOpen, setIsOpen] = useState(false)
  
  // Track if we've already applied the initial filter to prevent infinite loops
  const hasAppliedFilter = useRef(false)
  const lastAppliedScope = useRef<Scope | null>(null)

  // Check if user has permission to see all teams
  const canSeeAllTeams = user?.role === 'admin' || user?.role === 'staff-manager'

  // Get assigned team IDs - memoize to prevent reference changes
  const assignedTeams = (user as any)?.assignedTeams || []
  const teamIds = assignedTeams.map((team: any) =>
    typeof team === 'number' ? team : (team?.id || team)
  ).filter(Boolean)
  
  // Convert to string for stable comparison
  const teamIdsKey = teamIds.join(',')

  // Load saved preference from localStorage
  // Staff managers should default to 'all-teams' since they have access to all teams
  useEffect(() => {
    if (typeof window !== 'undefined' && canSeeAllTeams) {
      const saved = localStorage.getItem('poll-scope-preference')
      if (saved === 'my-teams') {
        setScope('my-teams')
      } else {
        // Default to 'all-teams' for staff managers
        setScope('all-teams')
      }
    }
  }, [canSeeAllTeams])

  // Apply filter when scope changes - using stable dependencies to prevent infinite loop
  useEffect(() => {
    if (!canSeeAllTeams || teamIds.length === 0) return
    
    // Prevent infinite loop: only update if scope actually changed
    if (lastAppliedScope.current === scope && hasAppliedFilter.current) {
      return
    }

    const currentTeamFilter = searchParams.get('where[team][in]')
    const expectedFilter = scope === 'my-teams' ? teamIdsKey : null
    
    // Only update URL if the filter actually needs to change
    if (scope === 'my-teams' && currentTeamFilter !== teamIdsKey) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('where[team][in]', teamIdsKey)
      lastAppliedScope.current = scope
      hasAppliedFilter.current = true
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    } else if (scope === 'all-teams' && currentTeamFilter !== null) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('where[team][in]')
      lastAppliedScope.current = scope
      hasAppliedFilter.current = true
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    } else {
      // Filter is already correct, just mark as applied
      lastAppliedScope.current = scope
      hasAppliedFilter.current = true
    }
  }, [scope, canSeeAllTeams, teamIdsKey, pathname, searchParams, router])

  // Don't show toggle if user can't see all teams or has no assigned teams
  if (!canSeeAllTeams || teamIds.length === 0) {
    return null
  }

  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope)
    localStorage.setItem('poll-scope-preference', newScope)
    setIsOpen(false)
  }

  return (
    <div className="poll-scope-toggle">
      <div className="poll-scope-toggle__container">
        <button
          className="poll-scope-toggle__button"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <span className="poll-scope-toggle__icon">
            {scope === 'my-teams' ? '👤' : '👥'}
          </span>
          <span className="poll-scope-toggle__label">
            {scope === 'my-teams' ? 'My Teams' : 'All Teams'}
          </span>
          <span className={`poll-scope-toggle__arrow ${isOpen ? 'poll-scope-toggle__arrow--open' : ''}`}>
            ▼
          </span>
        </button>
        
        {isOpen && (
          <div className="poll-scope-toggle__dropdown">
            <button
              className={`poll-scope-toggle__option ${scope === 'my-teams' ? 'poll-scope-toggle__option--active' : ''}`}
              onClick={() => handleScopeChange('my-teams')}
              type="button"
            >
              <span className="poll-scope-toggle__option-icon">👤</span>
              <span>My Teams</span>
              <span className="poll-scope-toggle__option-desc">Only polls for your assigned teams</span>
            </button>
            <button
              className={`poll-scope-toggle__option ${scope === 'all-teams' ? 'poll-scope-toggle__option--active' : ''}`}
              onClick={() => handleScopeChange('all-teams')}
              type="button"
            >
              <span className="poll-scope-toggle__option-icon">👥</span>
              <span>All Teams</span>
              <span className="poll-scope-toggle__option-desc">View polls from all teams</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PollScopeToggle
