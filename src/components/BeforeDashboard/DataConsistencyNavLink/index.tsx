'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Data Consistency nav link - shows in sidebar with issue count badge
 */
const DataConsistencyNavLink: React.FC = () => {
  const { user } = useAuth<User>()
  const [issueCount, setIssueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || user.role !== UserRole.ADMIN) {
      setLoading(false)
      return
    }

    const fetchIssueCount = async () => {
      try {
        const response = await fetch('/api/data-consistency-check', {
          credentials: 'include',
        })
        
        if (response.ok) {
          const data = await response.json()
          const totalItems = (data.issues || []).reduce(
            (sum: number, issue: any) => sum + (issue.items?.length || 0),
            0
          )
          setIssueCount(totalItems)
        }
      } catch (error) {
        console.error('Error fetching issue count:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIssueCount()
    
    // Refresh count every 5 minutes
    const interval = setInterval(fetchIssueCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // Only show for admins
  if (!user || user.role !== UserRole.ADMIN) return null

  return (
    <div className="data-consistency-nav-link">
      <a
        href="/data-consistency"
        target="_blank"
        rel="noopener noreferrer"
        className="data-consistency-nav-link__link"
      >
        <div className="data-consistency-nav-link__content">
          <span className="data-consistency-nav-link__icon">📊</span>
          <span>Data Consistency</span>
        </div>
        {!loading && issueCount > 0 && (
          <span
            className={`data-consistency-nav-link__badge ${issueCount > 0 ? 'data-consistency-nav-link__badge--error' : 'data-consistency-nav-link__badge--success'}`}
          >
            {issueCount}
          </span>
        )}
      </a>
    </div>
  )
}

export default DataConsistencyNavLink
