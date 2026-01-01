'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import { formatLocalDateTime } from '@/utilities/formatDateTime'

interface HealthStats {
  collections: {
    name: string
    count: number
  }[]
  recentAuditLogs: {
    total: number
    byAction: Record<string, number>
  }
  recentErrors: {
    total: number
    unresolved: number
    bySeverity: Record<string, number>
  }
  cronJobs: {
    name: string
    lastRun?: string
    lastStatus?: string
    failureCount: number
  }[]
  activeSessions: {
    total: number
    users: string[]
  }
}

export default function DatabaseHealthView() {
  const { config } = useConfig()
  const [stats, setStats] = useState<HealthStats | null>(null)
  const [loading, setLoading] = useState(true)

  const serverURL = config?.serverURL || ''

  useEffect(() => {
    const fetchData = async () => {
      await fetchHealthStats(true)
    }
    
    fetchData()
    
    // Refresh every minute without showing loading state
    const interval = setInterval(() => fetchHealthStats(false), 60000)
    return () => clearInterval(interval)
  }, [serverURL])

  const fetchHealthStats = async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true)
    }
    try {
      // Fetch collection counts
      const collections = [
        'teams',
        'people',
        'matches',
        'users',
        'audit-logs',
        'error-logs',
        'cron-job-runs',
        'active-sessions',
      ]

      const collectionCounts = await Promise.all(
        collections.map(async (name) => {
          try {
            const response = await fetch(
              `${serverURL}/api/${name}?limit=1`,
              { credentials: 'include' },
            )
            if (response.ok) {
              const data = await response.json()
              return { name, count: data.totalDocs || 0 }
            }
          } catch (error) {
            console.error(`Failed to fetch ${name} count:`, error)
          }
          return { name, count: 0 }
        }),
      )

      // Fetch recent audit logs
      const auditResponse = await fetch(
        `${serverURL}/api/audit-logs?limit=100&sort=-createdAt`,
        { credentials: 'include' },
      )
      const auditData = await auditResponse.json()
      const auditByAction: Record<string, number> = {}
      auditData.docs?.forEach((log: any) => {
        auditByAction[log.action] = (auditByAction[log.action] || 0) + 1
      })

      // Fetch recent errors
      const errorResponse = await fetch(
        `${serverURL}/api/error-logs?limit=100&sort=-createdAt`,
        { credentials: 'include' },
      )
      const errorData = await errorResponse.json()
      const unresolvedErrors = errorData.docs?.filter((e: any) => !e.resolved).length || 0
      const errorBySeverity: Record<string, number> = {}
      errorData.docs?.forEach((error: any) => {
        if (!error.resolved) {
          errorBySeverity[error.severity] = (errorBySeverity[error.severity] || 0) + 1
        }
      })

      // Fetch cron job stats
      const cronResponse = await fetch(
        `${serverURL}/api/cron-job-runs?limit=100&sort=-createdAt`,
        { credentials: 'include' },
      )
      const cronData = await cronResponse.json()
      
      const cronJobStats: Record<string, any> = {}
      cronData.docs?.forEach((run: any) => {
        if (!cronJobStats[run.jobName]) {
          cronJobStats[run.jobName] = {
            name: run.jobName,
            lastRun: run.startTime,
            lastStatus: run.status,
            failureCount: 0,
          }
        }
        if (run.status === 'failed') {
          cronJobStats[run.jobName].failureCount++
        }
      })

      // Fetch active sessions
      const sessionsResponse = await fetch(
        `${serverURL}/api/active-sessions?where=${encodeURIComponent(JSON.stringify({ isActive: { equals: true } }))}&depth=1`,
        { credentials: 'include' },
      )
      const sessionsData = await sessionsResponse.json()
      const activeUsers = sessionsData.docs?.map((s: any) => s.user?.name || s.user?.email || 'Unknown') || []

      setStats({
        collections: collectionCounts,
        recentAuditLogs: {
          total: auditData.totalDocs || 0,
          byAction: auditByAction,
        },
        recentErrors: {
          total: errorData.totalDocs || 0,
          unresolved: unresolvedErrors,
          bySeverity: errorBySeverity,
        },
        cronJobs: Object.values(cronJobStats),
        activeSessions: {
          total: sessionsData.totalDocs || 0,
          users: activeUsers,
        },
      })
    } catch (error) {
      console.error('Failed to fetch health stats:', error)
    } finally {
      if (showLoadingState) {
        setLoading(false)
      }
    }
  }

  const getJobDisplayName = (jobName: string) => {
    switch (jobName) {
      case 'smart-sync':
        return 'Smart Sync'
      case 'full-sync':
        return 'Full Sync'
      case 'session-cleanup':
        return 'Session Cleanup'
      default:
        return jobName
    }
  }

  if (loading) {
    return (
      <div className="monitoring-container">
        <div className="monitoring-loading">Loading health statistics...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="monitoring-container">
        <div className="monitoring-empty">Failed to load health statistics</div>
      </div>
    )
  }

  return (
    <div className="monitoring-container">
      <div className="monitoring-header">
        <h2>Database Health</h2>
        <p className="monitoring-description">
          System overview and health monitoring
        </p>
        <button onClick={() => fetchHealthStats(true)} className="monitoring-btn monitoring-btn--refresh">
          Refresh
        </button>
      </div>

      <div className="monitoring-health-grid">
        {/* Collection Counts */}
        <div className="monitoring-health-card">
          <h3>Collection Counts</h3>
          <div className="monitoring-health-stats">
            {stats.collections.map((col) => (
              <div key={col.name} className="monitoring-health-stat">
                <span className="monitoring-health-stat-label">{col.name}:</span>
                <span className="monitoring-health-stat-value">{col.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="monitoring-health-card">
          <h3>Recent Activity (Last 100)</h3>
          <div className="monitoring-health-stats">
            <div className="monitoring-health-stat">
              <span className="monitoring-health-stat-label">Total Audit Logs:</span>
              <span className="monitoring-health-stat-value">{stats.recentAuditLogs.total}</span>
            </div>
            {Object.entries(stats.recentAuditLogs.byAction).map(([action, count]) => (
              <div key={action} className="monitoring-health-stat monitoring-health-stat--indent">
                <span className="monitoring-health-stat-label">{action}:</span>
                <span className="monitoring-health-stat-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Summary */}
        <div className="monitoring-health-card">
          <h3>Error Summary</h3>
          <div className="monitoring-health-stats">
            <div className="monitoring-health-stat">
              <span className="monitoring-health-stat-label">Total Errors:</span>
              <span className="monitoring-health-stat-value">{stats.recentErrors.total}</span>
            </div>
            <div className="monitoring-health-stat">
              <span className="monitoring-health-stat-label">Unresolved:</span>
              <span className={`monitoring-health-stat-value ${stats.recentErrors.unresolved > 0 ? 'monitoring-health-stat-value--warning' : 'monitoring-health-stat-value--success'}`}>
                {stats.recentErrors.unresolved}
              </span>
            </div>
            {Object.entries(stats.recentErrors.bySeverity).map(([severity, count]) => (
              <div key={severity} className="monitoring-health-stat monitoring-health-stat--indent">
                <span className="monitoring-health-stat-label">{severity}:</span>
                <span className="monitoring-health-stat-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cron Job Health */}
        <div className="monitoring-health-card">
          <h3>Cron Job Health</h3>
          <div className="monitoring-health-stats">
            {stats.cronJobs.length === 0 ? (
              <div className="monitoring-health-empty">No cron jobs have run yet</div>
            ) : (
              stats.cronJobs.map((job) => (
                <div key={job.name} className="monitoring-health-cron">
                  <div className="monitoring-health-cron-name">
                    {getJobDisplayName(job.name)}
                  </div>
                  <div className="monitoring-health-cron-details">
                    {job.lastRun && (
                      <div className="monitoring-health-stat">
                        <span className="monitoring-health-stat-label">Last Run:</span>
                        <span className="monitoring-health-stat-value">
                          {formatLocalDateTime(job.lastRun)}
                        </span>
                      </div>
                    )}
                    <div className="monitoring-health-stat">
                      <span className="monitoring-health-stat-label">Last Status:</span>
                      <span className={`monitoring-health-stat-value ${job.lastStatus === 'success' ? 'monitoring-health-stat-value--success' : job.lastStatus === 'failed' ? 'monitoring-health-stat-value--danger' : ''}`}>
                        {job.lastStatus || 'N/A'}
                      </span>
                    </div>
                    <div className="monitoring-health-stat">
                      <span className="monitoring-health-stat-label">Recent Failures:</span>
                      <span className={`monitoring-health-stat-value ${job.failureCount > 0 ? 'monitoring-health-stat-value--warning' : ''}`}>
                        {job.failureCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="monitoring-health-card">
          <h3>Active Sessions</h3>
          <div className="monitoring-health-stats">
            <div className="monitoring-health-stat">
              <span className="monitoring-health-stat-label">Total Active:</span>
              <span className="monitoring-health-stat-value">{stats.activeSessions.total}</span>
            </div>
            {stats.activeSessions.users.length > 0 && (
              <div className="monitoring-health-users">
                <strong>Currently Online:</strong>
                <ul>
                  {stats.activeSessions.users.map((user, idx) => (
                    <li key={idx}>{user}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

