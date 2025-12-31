'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import { formatLocalDateTime } from '@/utilities/formatDateTime'

interface CronJobRun {
  id: number
  jobName: string
  status: 'running' | 'success' | 'failed'
  startTime: string
  endTime?: string
  duration?: number
  summary?: Record<string, any>
  errors?: string
  createdAt: string
}

export default function CronMonitorView() {
  const { config } = useConfig()
  const [runs, setRuns] = useState<CronJobRun[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const serverURL = config?.serverURL || ''

  useEffect(() => {
    fetchRuns()
    // Refresh every 30 seconds
    const interval = setInterval(fetchRuns, 30000)
    return () => clearInterval(interval)
  }, [filter, statusFilter])

  const fetchRuns = async () => {
    setLoading(true)
    try {
      const whereConditions: any[] = []
      
      if (filter !== 'all') {
        whereConditions.push({ jobName: { equals: filter } })
      }
      
      if (statusFilter !== 'all') {
        whereConditions.push({ status: { equals: statusFilter } })
      }

      const whereClause = whereConditions.length > 0 
        ? { and: whereConditions }
        : {}

      const response = await fetch(
        `${serverURL}/api/cron-job-runs?where=${encodeURIComponent(JSON.stringify(whereClause))}&limit=50&sort=-createdAt`,
        {
          credentials: 'include',
        },
      )

      if (response.ok) {
        const data = await response.json()
        setRuns(data.docs || [])
      }
    } catch (error) {
      console.error('Failed to fetch cron job runs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'success':
        return 'monitoring-badge monitoring-badge--success'
      case 'failed':
        return 'monitoring-badge monitoring-badge--danger'
      case 'running':
        return 'monitoring-badge monitoring-badge--info'
      default:
        return 'monitoring-badge'
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="monitoring-container">
      <div className="monitoring-header">
        <h2>Cron Job Monitor</h2>
        <p className="monitoring-description">
          Track scheduled job executions and performance
        </p>
      </div>

      <div className="monitoring-filters">
        <div className="monitoring-filter-group">
          <label htmlFor="job-filter">Job:</label>
          <select
            id="job-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="monitoring-select"
          >
            <option value="all">All Jobs</option>
            <option value="smart-sync">Smart Sync</option>
            <option value="full-sync">Full Sync</option>
            <option value="session-cleanup">Session Cleanup</option>
          </select>
        </div>

        <div className="monitoring-filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="monitoring-select"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </div>

        <button onClick={fetchRuns} className="monitoring-btn monitoring-btn--refresh">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="monitoring-loading">Loading cron job runs...</div>
      ) : runs.length === 0 ? (
        <div className="monitoring-empty">No cron job runs found</div>
      ) : (
        <div className="monitoring-cards">
          {runs.map((run) => (
            <div key={run.id} className="monitoring-card">
              <div className="monitoring-card-header">
                <h3>{getJobDisplayName(run.jobName)}</h3>
                <span className={getStatusBadgeClass(run.status)}>
                  {run.status}
                </span>
              </div>

              <div className="monitoring-card-body">
                <div className="monitoring-card-row">
                  <span className="monitoring-card-label">Started:</span>
                  <span className="monitoring-card-value">
                    {formatLocalDateTime(run.startTime)}
                  </span>
                </div>

                {run.endTime && (
                  <div className="monitoring-card-row">
                    <span className="monitoring-card-label">Completed:</span>
                    <span className="monitoring-card-value">
                      {formatLocalDateTime(run.endTime)}
                    </span>
                  </div>
                )}

                <div className="monitoring-card-row">
                  <span className="monitoring-card-label">Duration:</span>
                  <span className="monitoring-card-value">
                    {formatDuration(run.duration)}
                  </span>
                </div>

                {run.summary && Object.keys(run.summary).length > 0 && (
                  <details className="monitoring-card-details">
                    <summary>Summary</summary>
                    <pre>{JSON.stringify(run.summary, null, 2)}</pre>
                  </details>
                )}

                {run.errors && (
                  <div className="monitoring-card-errors">
                    <strong>Errors:</strong>
                    <pre>{run.errors}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

