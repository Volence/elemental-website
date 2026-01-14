'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'

import './index.scss'

type Scope = 'my-teams' | 'all-teams'

export const PollScopeToggle: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [scope, setScope] = useState<Scope>('my-teams')
  const [isOpen, setIsOpen] = useState(false)

  // Check if user has permission to see all teams
  const canSeeAllTeams = user?.role === 'admin' || user?.role === 'staff-manager'

  // Get assigned team IDs
  const assignedTeams = (user as any)?.assignedTeams || []
  const teamIds = assignedTeams.map((team: any) =>
    typeof team === 'number' ? team : (team?.id || team)
  ).filter(Boolean)

  // Load saved preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && canSeeAllTeams) {
      const saved = localStorage.getItem('poll-scope-preference')
      if (saved === 'all-teams') {
        setScope('all-teams')
      }
    }
  }, [canSeeAllTeams])

  // Apply filter when scope changes
  useEffect(() => {
    if (!canSeeAllTeams || teamIds.length === 0) return

    const params = new URLSearchParams(searchParams.toString())
    
    if (scope === 'my-teams') {
      // Apply team filter
      params.delete('where[team][in]')
      params.set('where[team][in]', teamIds.join(','))
    } else {
      // Remove team filter to show all
      params.delete('where[team][in]')
    }

    const newUrl = `${pathname}?${params.toString()}`
    router.replace(newUrl, { scroll: false })
  }, [scope, canSeeAllTeams, teamIds, pathname, searchParams, router])

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
