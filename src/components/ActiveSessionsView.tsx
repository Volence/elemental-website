'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import { formatLocalDateTime } from '@/utilities/formatDateTime'

interface ActiveSession {
  id: number
  user: {
    id: number
    name?: string
    email: string
  }
  loginTime: string
  lastActivity: string
  ipAddress?: string
  userAgent?: string
  isActive: boolean
}

export default function ActiveSessionsView() {
  const { config } = useConfig()
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('active')

  const serverURL = config?.serverURL || ''

  useEffect(() => {
    fetchSessions()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [filter])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const whereConditions: any[] = []

      if (filter === 'active') {
        whereConditions.push({ isActive: { equals: true } })
      } else if (filter === 'inactive') {
        whereConditions.push({ isActive: { equals: false } })
      }

      const whereClause = whereConditions.length > 0 ? { and: whereConditions } : {}

      const response = await fetch(
        `${serverURL}/api/active-sessions?where=${encodeURIComponent(JSON.stringify(whereClause))}&limit=100&depth=1&sort=-lastActivity`,
        {
          credentials: 'include',
        },
      )

      if (response.ok) {
        const data = await response.json()
        setSessions(data.docs || [])
      }
    } catch (error) {
      console.error('Failed to fetch active sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSessionStatus = (lastActivity: string): string => {
    const lastActivityTime = new Date(lastActivity).getTime()
    const now = new Date().getTime()
    const minutesAgo = Math.floor((now - lastActivityTime) / (1000 * 60))

    if (minutesAgo < 5) return 'active'
    if (minutesAgo < 15) return 'idle'
    return 'stale'
  }

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'active':
        return 'monitoring-badge monitoring-badge--success'
      case 'idle':
        return 'monitoring-badge monitoring-badge--yellow'
      case 'stale':
        return 'monitoring-badge monitoring-badge--neutral'
      default:
        return 'monitoring-badge'
    }
  }

  const getBrowser = (userAgent?: string): string => {
    if (!userAgent) return 'Unknown'
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Other'
  }

  return (
    <div className="monitoring-container">
      <div className="monitoring-header">
        <h2>Active Sessions</h2>
        <p className="monitoring-description">
          Monitor currently logged-in admin panel users
        </p>
      </div>

      <div className="monitoring-filters">
        <div className="monitoring-filter-group">
          <label htmlFor="session-filter">Status:</label>
          <select
            id="session-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
            }}
            className="monitoring-select"
          >
            <option value="all">All Sessions</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button onClick={fetchSessions} className="monitoring-btn monitoring-btn--refresh">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="monitoring-loading">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="monitoring-empty">No sessions found</div>
      ) : (
        <>
          <div className="monitoring-stats">
            <div className="monitoring-stat-card">
              <div className="monitoring-stat-value">{sessions.filter(s => getSessionStatus(s.lastActivity) === 'active').length}</div>
              <div className="monitoring-stat-label">Active Now</div>
            </div>
            <div className="monitoring-stat-card">
              <div className="monitoring-stat-value">{sessions.filter(s => s.isActive).length}</div>
              <div className="monitoring-stat-label">Total Active Sessions</div>
            </div>
            <div className="monitoring-stat-card">
              <div className="monitoring-stat-value">{new Set(sessions.map(s => s.user.id)).size}</div>
              <div className="monitoring-stat-label">Unique Users</div>
            </div>
          </div>

          <div className="monitoring-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Login Time</th>
                  <th>Last Activity</th>
                  <th>IP Address</th>
                  <th>Browser</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const status = getSessionStatus(session.lastActivity)
                  return (
                    <tr key={session.id}>
                      <td>
                        <div>
                          <strong>{session.user.name || session.user.email}</strong>
                          {session.user.name && (
                            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                              {session.user.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(status)}>
                          {status}
                        </span>
                      </td>
                      <td>{formatLocalDateTime(session.loginTime)}</td>
                      <td>{formatLocalDateTime(session.lastActivity)}</td>
                      <td>{session.ipAddress || '-'}</td>
                      <td>{getBrowser(session.userAgent)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}


