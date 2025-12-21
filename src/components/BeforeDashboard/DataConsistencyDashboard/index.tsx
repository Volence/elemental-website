'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

interface DetailedIssue {
  type: 'error' | 'warning'
  category: string
  message: string
  items: Array<{ id: number; name: string; slug?: string; details?: string }>
  autoFixable: boolean
}

/**
 * Data Consistency Dashboard - shows quick summary and links to detailed page
 */
const DataConsistencyDashboard: React.FC = () => {
  const { user } = useAuth<User>()
  const pathname = usePathname()
  const [issues, setIssues] = useState<DetailedIssue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Only show on dashboard page
    if (pathname !== '/admin' && pathname !== '/admin/') {
      setLoading(false)
      return
    }

    const fetchIssues = async () => {
      try {
        const response = await fetch('/api/data-consistency-check', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          setIssues(data.issues || [])
        }
      } catch (error) {
        console.error('Error fetching data consistency:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIssues()
  }, [user, pathname])

  if (loading || !user) return null
  if (pathname !== '/admin' && pathname !== '/admin/') return null
  if (issues.length === 0) return null

  const errorCount = issues.filter((i) => i.type === 'error').length
  const warningCount = issues.filter((i) => i.type === 'warning').length
  const totalItemsAffected = issues.reduce((sum, issue) => sum + issue.items.length, 0)
  const isAdmin = user?.role === UserRole.ADMIN

  const severity = errorCount > 0 ? 'error' : 'warning'

  return (
    <div
      className="data-consistency-dashboard"
      style={{
        backgroundColor:
          errorCount > 0
            ? 'var(--theme-error-50, rgba(220, 38, 38, 0.1))'
            : 'var(--theme-warning-50, rgba(251, 191, 36, 0.1))',
        borderColor: errorCount > 0 ? 'var(--theme-error-300)' : 'var(--theme-warning-300)',
        borderLeftColor: errorCount > 0 ? 'var(--theme-error-500)' : 'var(--theme-warning-500)',
      }}
    >
      <div className="data-consistency-dashboard__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM9 5H11V11H9V5ZM10 15C9.44772 15 9 14.5523 9 14C9 13.4477 9.44772 13 10 13C10.5523 13 11 13.4477 11 14C11 14.5523 10.5523 15 10 15Z"
              fill={errorCount > 0 ? 'var(--theme-error-600)' : 'var(--theme-warning-600)'}
            />
          </svg>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)' }}>
            Data Consistency Issues Found
          </h3>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
        {errorCount > 0 && (
          <div style={{ color: 'var(--theme-error-700)' }}>
            <strong style={{ fontSize: '1.25rem' }}>{errorCount}</strong> critical{' '}
            {errorCount === 1 ? 'error' : 'errors'}
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ color: 'var(--theme-warning-700)' }}>
            <strong style={{ fontSize: '1.25rem' }}>{warningCount}</strong>{' '}
            {warningCount === 1 ? 'warning' : 'warnings'}
          </div>
        )}
        <div style={{ color: 'var(--theme-text-600)' }}>
          <strong style={{ fontSize: '1.25rem' }}>{totalItemsAffected}</strong> items affected
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '1rem',
          backgroundColor: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: '6px',
        }}
      >
        {issues.map((issue, i) => (
          <div key={i} style={{ fontSize: '0.875rem', color: 'var(--theme-text-600)' }}>
            {issue.type === 'error' ? '❌' : '⚠️'} {issue.category}:{' '}
            <strong>{issue.items.length}</strong> affected
          </div>
        ))}
      </div>

      {isAdmin && (
        <a
          href="/admin/data-consistency"
          className="data-consistency-dashboard__link"
        >
          📊 View Detailed Report & Fix Issues
        </a>
      )}
    </div>
  )
}

export default DataConsistencyDashboard
