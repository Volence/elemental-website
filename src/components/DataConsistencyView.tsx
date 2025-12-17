'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

interface DetailedIssue {
  type: 'error' | 'warning'
  category: string
  message: string
  items: Array<{
    id: number
    name: string
    slug?: string
    details?: string
  }>
  autoFixable: boolean
}

const DataConsistencyView: React.FC = () => {
  const { user } = useAuth<User>()
  const [issues, setIssues] = useState<DetailedIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const isAdmin = user?.role === UserRole.ADMIN

  useEffect(() => {
    // Wait for user to load
    if (user !== undefined) {
      setAuthLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!isAdmin || authLoading) return
    fetchIssues()
  }, [isAdmin, authLoading])

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/data-consistency-check')
      const data = await response.json()
      setIssues(data.issues || [])
    } catch (error) {
      console.error('Error fetching data consistency issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFixAll = async () => {
    if (!confirm('This will attempt to fix all auto-fixable issues. Continue?')) return

    try {
      setFixing(true)
      setFixResult(null)
      const response = await fetch('/api/fix-data-issues', {
        method: 'POST',
      })
      const result = await response.json()
      setFixResult(result.message || 'Issues fixed successfully')
      // Refresh issues after fixing
      setTimeout(() => fetchIssues(), 1000)
    } catch (error) {
      setFixResult('Error fixing issues: ' + (error as Error).message)
    } finally {
      setFixing(false)
    }
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Access Denied</h1>
        <p>Only users with the "Admin" role can access this page.</p>
        {user && (
          <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.875rem' }}>
            Your current role: <strong>{user.role || 'None'}</strong>
          </p>
        )}
      </div>
    )
  }

  const errorIssues = issues.filter((i) => i.type === 'error')
  const warningIssues = issues.filter((i) => i.type === 'warning')
  const autoFixableCount = issues.filter((i) => i.autoFixable).length

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0, color: 'var(--theme-text)' }}>📊 Data Consistency Dashboard</h1>
        {autoFixableCount > 0 && (
          <button
            onClick={handleFixAll}
            disabled={fixing}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--theme-success-500)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: fixing ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              opacity: fixing ? 0.6 : 1,
            }}
          >
            {fixing ? 'Fixing...' : `Fix All Auto-Fixable Issues (${autoFixableCount})`}
          </button>
        )}
      </div>

      {fixResult && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            backgroundColor: fixResult.includes('Error') ? 'var(--theme-error-50)' : 'var(--theme-success-50)',
            border: `1px solid ${fixResult.includes('Error') ? 'var(--theme-error-300)' : 'var(--theme-success-300)'}`,
            borderRadius: '6px',
            color: 'var(--theme-text)',
          }}
        >
          {fixResult}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading data consistency checks...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                padding: '1.5rem',
                backgroundColor: errorIssues.length > 0 ? 'var(--theme-error-50)' : 'var(--theme-success-50)',
                border: `2px solid ${errorIssues.length > 0 ? 'var(--theme-error-300)' : 'var(--theme-success-300)'}`,
                borderRadius: '8px',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'var(--theme-text)' }}>
                {errorIssues.length}
              </h3>
              <p style={{ margin: 0, color: 'var(--theme-text-secondary)' }}>Critical Errors</p>
            </div>
            <div
              style={{
                padding: '1.5rem',
                backgroundColor: warningIssues.length > 0 ? 'var(--theme-warning-50)' : 'var(--theme-success-50)',
                border: `2px solid ${warningIssues.length > 0 ? 'var(--theme-warning-300)' : 'var(--theme-success-300)'}`,
                borderRadius: '8px',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'var(--theme-text)' }}>
                {warningIssues.length}
              </h3>
              <p style={{ margin: 0, color: 'var(--theme-text-secondary)' }}>Warnings</p>
            </div>
            <div
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--theme-elevation-100)',
                border: '2px solid var(--theme-elevation-300)',
                borderRadius: '8px',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'var(--theme-text)' }}>
                {autoFixableCount}
              </h3>
              <p style={{ margin: 0, color: 'var(--theme-text-secondary)' }}>Auto-Fixable</p>
            </div>
          </div>

          {/* Detailed Issues */}
          {issues.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem',
                backgroundColor: 'var(--theme-success-50)',
                border: '2px solid var(--theme-success-300)',
                borderRadius: '8px',
              }}
            >
              <h2 style={{ color: 'var(--theme-success-600)' }}>✅ All Clear!</h2>
              <p style={{ color: 'var(--theme-text-secondary)' }}>No data consistency issues detected.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {issues.map((issue, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--theme-elevation-50)',
                    border: `2px solid ${issue.type === 'error' ? 'var(--theme-error-300)' : 'var(--theme-warning-300)'}`,
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: '0 0 0.5rem 0',
                          color: issue.type === 'error' ? 'var(--theme-error-600)' : 'var(--theme-warning-600)',
                        }}
                      >
                        {issue.type === 'error' ? '❌' : '⚠️'} {issue.category}
                      </h3>
                      <p style={{ margin: '0 0 1rem 0', color: 'var(--theme-text-secondary)' }}>{issue.message}</p>
                    </div>
                    {issue.autoFixable && (
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: 'var(--theme-elevation-200)',
                          color: 'var(--theme-text)',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        Auto-Fixable
                      </span>
                    )}
                  </div>

                  {/* List of affected items */}
                  {issue.items.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--theme-text-secondary)' }}>
                        Affected Items ({issue.items.length}):
                      </h4>
                      <div
                        style={{
                          maxHeight: '300px',
                          overflowY: 'auto',
                          backgroundColor: 'var(--theme-elevation-100)',
                          borderRadius: '4px',
                          padding: '0.5rem',
                          border: '1px solid var(--theme-elevation-200)',
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--theme-elevation-300)' }}>
                              <th
                                style={{
                                  textAlign: 'left',
                                  padding: '0.5rem',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  color: 'var(--theme-text)',
                                }}
                              >
                                ID
                              </th>
                              <th
                                style={{
                                  textAlign: 'left',
                                  padding: '0.5rem',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  color: 'var(--theme-text)',
                                }}
                              >
                                Name
                              </th>
                              {issue.items.some((item) => item.slug) && (
                                <th
                                  style={{
                                    textAlign: 'left',
                                    padding: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: 'var(--theme-text)',
                                  }}
                                >
                                  Slug
                                </th>
                              )}
                              {issue.items.some((item) => item.details) && (
                                <th
                                  style={{
                                    textAlign: 'left',
                                    padding: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: 'var(--theme-text)',
                                  }}
                                >
                                  Details
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {issue.items.map((item) => (
                              <tr
                                key={item.id}
                                style={{ borderBottom: '1px solid var(--theme-elevation-200)' }}
                              >
                                <td
                                  style={{
                                    padding: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontFamily: 'monospace',
                                    color: 'var(--theme-text)',
                                  }}
                                >
                                  {item.id}
                                </td>
                                <td style={{ padding: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-text)' }}>
                                  {item.name}
                                </td>
                                {issue.items.some((i) => i.slug) && (
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      fontSize: '0.875rem',
                                      fontFamily: 'monospace',
                                      color: 'var(--theme-text-secondary)',
                                    }}
                                  >
                                    {item.slug || '-'}
                                  </td>
                                )}
                                {issue.items.some((i) => i.details) && (
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      fontSize: '0.875rem',
                                      color: 'var(--theme-text-secondary)',
                                    }}
                                  >
                                    {item.details || '-'}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: 'var(--theme-elevation-100)',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: 'var(--theme-text-secondary)',
        }}
      >
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--theme-text)' }}>
          <strong>About Data Consistency Checks:</strong>
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Checks for broken relationships (deleted persons still referenced in teams)</li>
          <li>Identifies people without team assignments</li>
          <li>Detects incomplete rosters (teams with missing positions)</li>
          <li>Finds duplicate names across collections</li>
        </ul>
      </div>
    </div>
  )
}

export default DataConsistencyView
