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
    <div
      style={{
        borderTop: '1px solid var(--theme-elevation-200)',
        borderBottom: '1px solid var(--theme-elevation-200)',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
      }}
    >
      <a
        href="/admin/data-consistency"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          color: 'var(--theme-text)',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          transition: 'background-color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.125rem' }}>📊</span>
          <span>Data Consistency</span>
        </div>
        {!loading && issueCount > 0 && (
          <span
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: issueCount > 0 ? 'var(--theme-error-500)' : 'var(--theme-success-500)',
              color: 'white',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              minWidth: '24px',
              textAlign: 'center',
            }}
          >
            {issueCount}
          </span>
        )}
      </a>
    </div>
  )
}

export default DataConsistencyNavLink
