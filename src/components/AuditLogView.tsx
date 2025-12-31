'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import { formatLocalDateTime } from '@/utilities/formatDateTime'

interface AuditLog {
  id: number
  user?: {
    id: number
    name?: string
    email?: string
  }
  action: string
  collection?: string
  documentId?: string
  documentTitle?: string
  metadata?: Record<string, any>
  ipAddress?: string
  createdAt: string
}

export default function AuditLogView() {
  const { config } = useConfig()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const serverURL = config?.serverURL || ''

  useEffect(() => {
    fetchLogs()
  }, [filter, page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let whereClause = {}
      
      if (filter !== 'all') {
        whereClause = { action: { equals: filter } }
      }

      const response = await fetch(
        `${serverURL}/api/audit-logs?where=${encodeURIComponent(JSON.stringify(whereClause))}&limit=50&page=${page}&depth=1&sort=-createdAt`,
        {
          credentials: 'include',
        },
      )

      if (response.ok) {
        const data = await response.json()
        setLogs(data.docs || [])
        setTotalPages(data.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'login':
        return 'monitoring-badge monitoring-badge--success'
      case 'logout':
        return 'monitoring-badge monitoring-badge--neutral'
      case 'create':
        return 'monitoring-badge monitoring-badge--info'
      case 'delete':
        return 'monitoring-badge monitoring-badge--danger'
      case 'update':
        return 'monitoring-badge monitoring-badge--warning'
      case 'bulk':
        return 'monitoring-badge monitoring-badge--purple'
      default:
        return 'monitoring-badge'
    }
  }

  return (
    <div className="monitoring-container">
      <div className="monitoring-header">
        <h2>Audit Log</h2>
        <p className="monitoring-description">
          Track user actions for security and compliance monitoring
        </p>
      </div>

      <div className="monitoring-filters">
        <label htmlFor="action-filter">Filter by action:</label>
        <select
          id="action-filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          className="monitoring-select"
        >
          <option value="all">All Actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="create">Create</option>
          <option value="delete">Delete</option>
          <option value="update">Update</option>
          <option value="bulk">Bulk Operations</option>
        </select>
      </div>

      {loading ? (
        <div className="monitoring-loading">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="monitoring-empty">No audit logs found</div>
      ) : (
        <>
          <div className="monitoring-timeline">
            {logs.map((log) => (
              <div key={log.id} className="monitoring-timeline-item">
                <div className="monitoring-timeline-marker" />
                <div className="monitoring-timeline-content">
                  <div className="monitoring-timeline-header">
                    <span className={getActionBadgeClass(log.action)}>
                      {log.action}
                    </span>
                    <span className="monitoring-timeline-time">
                      {formatLocalDateTime(log.createdAt)}
                    </span>
                  </div>
                  
                  <div className="monitoring-timeline-body">
                    <div className="monitoring-timeline-user">
                      <strong>User:</strong>{' '}
                      {log.user?.name || log.user?.email || 'System'}
                    </div>
                    
                    {log.collection && (
                      <div className="monitoring-timeline-detail">
                        <strong>Collection:</strong> {log.collection}
                      </div>
                    )}
                    
                    {log.documentTitle && (
                      <div className="monitoring-timeline-detail">
                        <strong>Document:</strong> {log.documentTitle}
                      </div>
                    )}
                    
                    {log.ipAddress && (
                      <div className="monitoring-timeline-detail">
                        <strong>IP Address:</strong> {log.ipAddress}
                      </div>
                    )}
                    
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="monitoring-timeline-metadata">
                        <summary>Additional Details</summary>
                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="monitoring-pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="monitoring-btn"
              >
                Previous
              </button>
              <span className="monitoring-pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="monitoring-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

