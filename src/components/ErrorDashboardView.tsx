'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import { formatLocalDateTime } from '@/utilities/formatDateTime'

interface ErrorLog {
  id: number
  user?: {
    id: number
    name?: string
    email?: string
  }
  errorType: string
  message: string
  stack?: string
  url?: string
  severity: string
  resolved: boolean
  resolvedAt?: string
  notes?: string
  createdAt: string
}

interface GroupedError {
  message: string
  errorType: string
  severity: string
  count: number
  occurrences: ErrorLog[]
  mostRecentDate: string
  allResolved: boolean
  affectedUsers: Array<{ id: number; name?: string; email?: string }>
}

export default function ErrorDashboardView() {
  const { config } = useConfig()
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [resolvedFilter, setResolvedFilter] = useState<string>('unresolved')
  const [resolvingIds, setResolvingIds] = useState<Set<number>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const serverURL = config?.serverURL || ''

  useEffect(() => {
    fetchErrors()
  }, [typeFilter, severityFilter, resolvedFilter])

  const fetchErrors = async () => {
    setLoading(true)
    try {
      const whereConditions: any[] = []
      
      if (typeFilter !== 'all') {
        whereConditions.push({ errorType: { equals: typeFilter } })
      }
      
      if (severityFilter !== 'all') {
        whereConditions.push({ severity: { equals: severityFilter } })
      }
      
      // Note: resolved filter is applied after grouping on the frontend
      // to ensure groups show complete information (all occurrences, affected users, etc.)

      const whereClause = whereConditions.length > 0 
        ? { and: whereConditions }
        : {}

      const response = await fetch(
        `${serverURL}/api/error-logs?where=${encodeURIComponent(JSON.stringify(whereClause))}&limit=200&depth=1&sort=-createdAt`,
        {
          credentials: 'include',
        },
      )

      if (response.ok) {
        const data = await response.json()
        setErrors(data.docs || [])
      }
    } catch (error) {
      console.error('Failed to fetch error logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupErrors = (): GroupedError[] => {
    const groups = new Map<string, GroupedError>()

    errors.forEach((error) => {
      // Group by message + errorType (so same error from different types are separate)
      const groupKey = `${error.message}|||${error.errorType}`

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          message: error.message,
          errorType: error.errorType,
          severity: error.severity, // Use severity from first occurrence
          count: 0,
          occurrences: [],
          mostRecentDate: error.createdAt,
          allResolved: true,
          affectedUsers: [],
        })
      }

      const group = groups.get(groupKey)!
      group.count++
      group.occurrences.push(error)
      
      // Track if any occurrence is unresolved
      if (!error.resolved) {
        group.allResolved = false
      }

      // Update most recent date
      if (new Date(error.createdAt) > new Date(group.mostRecentDate)) {
        group.mostRecentDate = error.createdAt
      }

      // Track affected users (deduplicated)
      if (error.user) {
        const userExists = group.affectedUsers.some(u => u.id === error.user!.id)
        if (!userExists) {
          group.affectedUsers.push(error.user)
        }
      }
    })

    // Convert to array
    const allGroups = Array.from(groups.values())

    // Filter groups based on resolved status (frontend filtering)
    let filteredGroups = allGroups
    if (resolvedFilter === 'unresolved') {
      // Only show groups that have at least one unresolved error
      filteredGroups = allGroups.filter(group => !group.allResolved)
    } else if (resolvedFilter === 'resolved') {
      // Only show groups where all errors are resolved
      filteredGroups = allGroups.filter(group => group.allResolved)
    }
    // If resolvedFilter === 'all', show everything (no filtering)

    // Sort by most recent first
    return filteredGroups.sort((a, b) => 
      new Date(b.mostRecentDate).getTime() - new Date(a.mostRecentDate).getTime()
    )
  }

  const markAsResolved = async (errorId: number) => {
    setResolvingIds((prev) => new Set(prev).add(errorId))
    
    try {
      const response = await fetch(
        `${serverURL}/api/error-logs/${errorId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            resolved: true,
            resolvedAt: new Date().toISOString(),
          }),
        },
      )

      if (response.ok) {
        // Update local state
        setErrors((prev) =>
          prev.map((err) =>
            err.id === errorId
              ? { ...err, resolved: true, resolvedAt: new Date().toISOString() }
              : err,
          ),
        )
      }
    } catch (error) {
      console.error('Failed to mark error as resolved:', error)
      alert('Failed to mark error as resolved. Please try again.')
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev)
        next.delete(errorId)
        return next
      })
    }
  }

  const markAllInGroupAsResolved = async (group: GroupedError) => {
    const unresolvedIds = group.occurrences
      .filter(e => !e.resolved)
      .map(e => e.id)

    // Mark all as resolving
    setResolvingIds((prev) => {
      const next = new Set(prev)
      unresolvedIds.forEach(id => next.add(id))
      return next
    })

    // Resolve all in parallel
    await Promise.all(
      unresolvedIds.map(id => markAsResolved(id))
    )
  }

  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'monitoring-badge monitoring-badge--critical'
      case 'high':
        return 'monitoring-badge monitoring-badge--danger'
      case 'medium':
        return 'monitoring-badge monitoring-badge--warning'
      case 'low':
        return 'monitoring-badge monitoring-badge--info'
      default:
        return 'monitoring-badge'
    }
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'api':
        return 'monitoring-badge monitoring-badge--purple'
      case 'frontend':
        return 'monitoring-badge monitoring-badge--blue'
      case 'validation':
        return 'monitoring-badge monitoring-badge--yellow'
      case 'system':
        return 'monitoring-badge monitoring-badge--red'
      default:
        return 'monitoring-badge'
    }
  }

  const groupedErrors = groupErrors()

  return (
    <div className="monitoring-container">
      <div className="monitoring-header">
        <h2>Error Dashboard</h2>
        <p className="monitoring-description">
          Monitor and track application errors for debugging
        </p>
      </div>

      <div className="monitoring-filters">
        <div className="monitoring-filter-group">
          <label htmlFor="type-filter">Type:</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="monitoring-select"
          >
            <option value="all">All Types</option>
            <option value="api">API</option>
            <option value="backend">Backend</option>
            <option value="database">Database</option>
            <option value="frontend">Frontend</option>
            <option value="validation">Validation</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className="monitoring-filter-group">
          <label htmlFor="severity-filter">Severity:</label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="monitoring-select"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="monitoring-filter-group">
          <label htmlFor="resolved-filter">Status:</label>
          <select
            id="resolved-filter"
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="monitoring-select"
          >
            <option value="unresolved">Unresolved Only</option>
            <option value="resolved">Resolved Only</option>
            <option value="all">All</option>
          </select>
        </div>

        <button onClick={fetchErrors} className="monitoring-btn monitoring-btn--refresh">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="monitoring-loading">Loading error logs...</div>
      ) : groupedErrors.length === 0 ? (
        <div className="monitoring-empty">
          {resolvedFilter === 'unresolved' 
            ? '✅ No unresolved errors found!' 
            : 'No error logs found'}
        </div>
      ) : (
        <div className="monitoring-cards monitoring-cards--single">
          {groupedErrors.map((group) => {
            const groupKey = `${group.message}|||${group.errorType}`
            const isExpanded = expandedGroups.has(groupKey)
            
            return (
              <div 
                key={groupKey} 
                className={`monitoring-card ${group.allResolved ? 'monitoring-card--resolved' : ''}`}
              >
                <div className="monitoring-card-header">
                  <div className="monitoring-card-badges">
                    <span className={getSeverityBadgeClass(group.severity)}>
                      {group.severity}
                    </span>
                    <span className={getTypeBadgeClass(group.errorType)}>
                      {group.errorType}
                    </span>
                    {group.count > 1 && (
                      <span className="monitoring-badge monitoring-badge--neutral">
                        {group.count}x
                      </span>
                    )}
                    {group.allResolved && (
                      <span className="monitoring-badge monitoring-badge--success">
                        Resolved
                      </span>
                    )}
                  </div>
                  <span className="monitoring-card-time">
                    Most recent: {formatLocalDateTime(group.mostRecentDate)}
                  </span>
                </div>

                <div className="monitoring-card-body">
                  <div className="monitoring-error-message">
                    {group.message}
                  </div>

                  {group.affectedUsers.length > 0 && (
                    <div className="monitoring-card-row">
                      <span className="monitoring-card-label">Affected Users:</span>
                      <span className="monitoring-card-value">
                        {group.affectedUsers.map(u => u.name || u.email).join(', ')}
                        {group.affectedUsers.length > 3 && ` (+${group.affectedUsers.length - 3} more)`}
                      </span>
                    </div>
                  )}

                  {group.count > 1 && (
                    <div className="monitoring-error-group-summary">
                      <button
                        onClick={() => toggleGroupExpanded(groupKey)}
                        className="monitoring-group-toggle"
                      >
                        {isExpanded ? '▼' : '▶'} {group.count} occurrences ({group.occurrences.filter(e => !e.resolved).length} unresolved)
                      </button>

                      {isExpanded && (
                        <div className="monitoring-occurrence-list">
                          {group.occurrences.map((occurrence) => (
                            <div 
                              key={occurrence.id} 
                              className={`monitoring-occurrence ${occurrence.resolved ? 'monitoring-occurrence--resolved' : ''}`}
                            >
                              <div className="monitoring-occurrence-header">
                                <div>
                                  <strong>{occurrence.user?.name || occurrence.user?.email || 'System'}</strong>
                                  <span className="monitoring-occurrence-time">
                                    {formatLocalDateTime(occurrence.createdAt)}
                                  </span>
                                </div>
                                {occurrence.resolved ? (
                                  <span className="monitoring-badge monitoring-badge--success">Resolved</span>
                                ) : (
                                  <button
                                    onClick={() => markAsResolved(occurrence.id)}
                                    disabled={resolvingIds.has(occurrence.id)}
                                    className="monitoring-occurrence-resolve"
                                  >
                                    {resolvingIds.has(occurrence.id) ? '...' : 'Resolve'}
                                  </button>
                                )}
                              </div>
                              {occurrence.url && (
                                <div className="monitoring-occurrence-url">
                                  {occurrence.url}
                                </div>
                              )}
                              {occurrence.stack && (
                                <details className="monitoring-occurrence-stack">
                                  <summary>Stack Trace</summary>
                                  <pre>{occurrence.stack}</pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Single occurrence details */}
                  {group.count === 1 && (
                    <>
                      {group.occurrences[0].url && (
                        <div className="monitoring-card-row">
                          <span className="monitoring-card-label">URL:</span>
                          <span className="monitoring-card-value monitoring-card-url">
                            {group.occurrences[0].url}
                          </span>
                        </div>
                      )}

                      {group.occurrences[0].stack && (
                        <details className="monitoring-card-details">
                          <summary>Stack Trace</summary>
                          <pre className="monitoring-stack-trace">{group.occurrences[0].stack}</pre>
                        </details>
                      )}
                    </>
                  )}

                  {!group.allResolved && (
                    <div className="monitoring-card-actions">
                      <button
                        onClick={() => group.count === 1 
                          ? markAsResolved(group.occurrences[0].id)
                          : markAllInGroupAsResolved(group)
                        }
                        disabled={group.occurrences.some(e => resolvingIds.has(e.id))}
                        className="monitoring-action-btn monitoring-action-btn--resolve"
                      >
                        {group.count === 1 ? 'Mark as Resolved' : `Resolve All (${group.occurrences.filter(e => !e.resolved).length})`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
