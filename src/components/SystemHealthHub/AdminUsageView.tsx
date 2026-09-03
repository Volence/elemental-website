'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { formatLocalDateTime } from '@/utilities/formatDateTime'
import type { UsageSummary } from '@/utilities/adminTelemetry'

const WINDOWS = [7, 30, 90] as const

/**
 * System Health > Usage. Which admin screens get opened, by whom, how often.
 * Data comes from the admin-page-views collection via /api/admin-telemetry/summary.
 */
export default function AdminUsageView() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin-telemetry/summary?days=${days}`, { credentials: 'include' })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `Request failed (HTTP ${res.status})`)
      }
      setSummary(body.summary as UsageSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const maxDay = summary ? Math.max(1, ...summary.perDay.map((d) => d.views)) : 1

  return (
    <div className="monitoring-container">
      <div className="monitoring-header">
        <h3>Admin Usage</h3>
        <p className="monitoring-description">
          Page views inside the admin panel, recorded on every navigation. Use this to decide what the
          dashboard and sidebar should lead with.
        </p>
      </div>

      <div className="monitoring-filters">
        <div className="monitoring-filter-group">
          <label>Window</label>
          <select
            className="monitoring-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as (typeof WINDOWS)[number])}
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Last {w} days
              </option>
            ))}
          </select>
        </div>
        <button onClick={() => void load()} className="monitoring-btn monitoring-btn--refresh" disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="monitoring-empty" role="alert">
          {error}
        </div>
      )}

      {loading && !summary && <div className="monitoring-loading">Loading usage...</div>}

      {summary && (
        <>
          <div className="monitoring-stats">
            <div className="monitoring-stat-card">
              <div className="monitoring-stat-value">{summary.totalViews.toLocaleString()}</div>
              <div className="monitoring-stat-label">Page views</div>
            </div>
            <div className="monitoring-stat-card">
              <div className="monitoring-stat-value">{summary.uniquePeople.toLocaleString()}</div>
              <div className="monitoring-stat-label">People</div>
            </div>
            <div className="monitoring-stat-card">
              <div className="monitoring-stat-value">{summary.topPaths.length}</div>
              <div className="monitoring-stat-label">Distinct screens</div>
            </div>
          </div>

          {summary.totalViews === 0 ? (
            <div className="monitoring-empty">
              No page views recorded in this window yet. Views are collected from the moment this
              feature deployed, so give it a few days.
            </div>
          ) : (
            <>
              <h4 style={{ margin: '20px 0 8px' }}>Views per day</h4>
              <div
                style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}
                aria-label="Views per day"
              >
                {summary.perDay.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.views} views`}
                    style={{
                      flex: 1,
                      height: `${Math.max(2, Math.round((d.views / maxDay) * 100))}%`,
                      background: 'var(--theme-elevation-500, #64748b)',
                      borderRadius: 2,
                    }}
                  />
                ))}
              </div>

              <h4 style={{ margin: '20px 0 8px' }}>Most used screens</h4>
              <table className="monitoring-table">
                <thead>
                  <tr>
                    <th>Path</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th style={{ textAlign: 'right' }}>People</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topPaths.map((row) => (
                    <tr key={row.path}>
                      <td>
                        <code>{row.path}</code>
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.views.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{row.people.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 style={{ margin: '20px 0 8px' }}>By role</h4>
              <table className="monitoring-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th style={{ textAlign: 'right' }}>People</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byRole.map((row) => (
                    <tr key={row.role}>
                      <td>{row.role}</td>
                      <td style={{ textAlign: 'right' }}>{row.views.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{row.people.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 style={{ margin: '20px 0 8px' }}>Most active people</h4>
              <table className="monitoring-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topPeople.map((row) => (
                    <tr key={row.personId ?? 'unknown'}>
                      <td>{row.name ?? (row.personId ? `Person #${row.personId}` : 'Unknown')}</td>
                      <td style={{ textAlign: 'right' }}>{row.views.toLocaleString()}</td>
                      <td>{formatLocalDateTime(row.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}
