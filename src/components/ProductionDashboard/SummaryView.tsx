'use client'

import React, { useState, useEffect } from 'react'

interface User {
  id: number
  name?: string
  email?: string
}

interface Match {
  id: number
  title: string
  date: string
  productionWorkflow?: {
    coverageStatus: string
    assignedObserver?: User | number | null
    assignedProducer?: User | number | null
    assignedCasters?: Array<{ user: User | number }>
    includeInSchedule: boolean
  }
}

interface StaffWorkload {
  userId: number
  userName: string
  observerCount: number
  producerCount: number
  casterCount: number
  totalCount: number
}

export function SummaryView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const query = `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&where[productionWorkflow.isArchived][not_equals]=true&where[status][not_equals]=complete&sort=date&limit=100&depth=2`

      const response = await fetch(query)
      const data = await response.json()
      setMatches(data.docs || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const getUserName = (user: User | number | null | undefined): string => {
    if (!user) return 'Unknown'
    if (typeof user === 'number') return `User #${user}`
    return user.name || user.email || 'Unknown'
  }

  const getUserId = (user: User | number | null | undefined): number | null => {
    if (!user) return null
    if (typeof user === 'number') return user
    return user.id
  }

  // Calculate coverage stats
  const coverageStats = {
    full: matches.filter(m => m.productionWorkflow?.coverageStatus === 'full').length,
    partial: matches.filter(m => m.productionWorkflow?.coverageStatus === 'partial').length,
    none: matches.filter(m => m.productionWorkflow?.coverageStatus === 'none').length,
    total: matches.length
  }

  const scheduleStats = {
    included: matches.filter(m => m.productionWorkflow?.includeInSchedule).length,
    ready: matches.filter(m => m.productionWorkflow?.coverageStatus === 'full').length
  }

  // Calculate staff workload
  const staffWorkloadMap = new Map<number, StaffWorkload>()

  matches.forEach(match => {
    const pw = match.productionWorkflow
    if (!pw) return

    // Observer
    const observerId = getUserId(pw.assignedObserver)
    if (observerId) {
      const existing = staffWorkloadMap.get(observerId) || {
        userId: observerId,
        userName: getUserName(pw.assignedObserver as User),
        observerCount: 0,
        producerCount: 0,
        casterCount: 0,
        totalCount: 0
      }
      existing.observerCount++
      existing.totalCount++
      staffWorkloadMap.set(observerId, existing)
    }

    // Producer
    const producerId = getUserId(pw.assignedProducer)
    if (producerId) {
      const existing = staffWorkloadMap.get(producerId) || {
        userId: producerId,
        userName: getUserName(pw.assignedProducer as User),
        observerCount: 0,
        producerCount: 0,
        casterCount: 0,
        totalCount: 0
      }
      existing.producerCount++
      existing.totalCount++
      staffWorkloadMap.set(producerId, existing)
    }

    // Casters
    pw.assignedCasters?.forEach(caster => {
      const casterId = getUserId(caster.user)
      if (casterId) {
        const existing = staffWorkloadMap.get(casterId) || {
          userId: casterId,
          userName: getUserName(caster.user as User),
          observerCount: 0,
          producerCount: 0,
          casterCount: 0,
          totalCount: 0
        }
        existing.casterCount++
        existing.totalCount++
        staffWorkloadMap.set(casterId, existing)
      }
    })
  })

  const staffWorkload = Array.from(staffWorkloadMap.values())
    .sort((a, b) => b.totalCount - a.totalCount)

  // Matches needing attention
  const needingAttention = matches.filter(m => {
    const pw = m.productionWorkflow
    if (!pw) return true
    return pw.coverageStatus === 'none' || pw.coverageStatus === 'partial'
  })

  if (loading) {
    return <div className="production-dashboard__loading">Loading summary...</div>
  }

  return (
    <div className="production-dashboard__summary">
      <div className="production-dashboard__header">
        <h2>Production Summary</h2>
        <p className="production-dashboard__subtitle">
          Overview of this week's match coverage and staff assignments
        </p>
      </div>

      <div className="summary-grid">
        {/* Coverage Overview */}
        <div className="summary-card">
          <h3>📊 Coverage Overview</h3>
          <div className="summary-stats">
            <div className="summary-stat summary-stat--success">
              <div className="summary-stat__value">{coverageStats.full}</div>
              <div className="summary-stat__label">Full Coverage</div>
            </div>
            <div className="summary-stat summary-stat--warning">
              <div className="summary-stat__value">{coverageStats.partial}</div>
              <div className="summary-stat__label">Partial Coverage</div>
            </div>
            <div className="summary-stat summary-stat--error">
              <div className="summary-stat__value">{coverageStats.none}</div>
              <div className="summary-stat__label">No Coverage</div>
            </div>
          </div>
          <div className="summary-progress">
            <div className="summary-progress__bar">
              <div
                className="summary-progress__fill summary-progress__fill--full"
                style={{ width: `${(coverageStats.full / coverageStats.total) * 100}%` }}
              />
              <div
                className="summary-progress__fill summary-progress__fill--partial"
                style={{ width: `${(coverageStats.partial / coverageStats.total) * 100}%` }}
              />
            </div>
            <div className="summary-progress__label">
              {Math.round(((coverageStats.full + coverageStats.partial) / coverageStats.total) * 100)}% of matches have coverage
            </div>
          </div>
        </div>

        {/* Schedule Status */}
        <div className="summary-card">
          <h3>📅 Broadcast Schedule</h3>
          <div className="summary-stats">
            <div className="summary-stat summary-stat--success">
              <div className="summary-stat__value">{scheduleStats.included}</div>
              <div className="summary-stat__label">Scheduled</div>
            </div>
            <div className="summary-stat summary-stat--info">
              <div className="summary-stat__value">{scheduleStats.ready}</div>
              <div className="summary-stat__label">Ready to Schedule</div>
            </div>
          </div>
          <p className="summary-card__description">
            {scheduleStats.included === 0
              ? 'No matches selected for broadcast yet. Use Schedule Builder to add matches.'
              : `${scheduleStats.included} match${scheduleStats.included !== 1 ? 'es' : ''} scheduled for broadcast this week.`}
          </p>
        </div>

        {/* Staff Workload */}
        <div className="summary-card summary-card--wide">
          <h3>👥 Staff Workload</h3>
          {staffWorkload.length === 0 ? (
            <p className="summary-empty">No staff assigned yet. Use the Assignment tab to assign staff to matches.</p>
          ) : (
            <div className="summary-table">
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Observer</th>
                    <th>Producer</th>
                    <th>Caster</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {staffWorkload.map((staff) => (
                    <tr key={staff.userId}>
                      <td><strong>{staff.userName}</strong></td>
                      <td>{staff.observerCount || '-'}</td>
                      <td>{staff.producerCount || '-'}</td>
                      <td>{staff.casterCount || '-'}</td>
                      <td>
                        <span className="summary-workload-badge">
                          {staff.totalCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Matches Needing Attention - Only show if there are matches needing attention */}
        {needingAttention.length > 0 && (
          <div className="summary-card summary-card--wide">
            <h3>⚠️ Matches Needing Attention ({needingAttention.length})</h3>
            <div className="summary-match-list">
              {needingAttention.slice(0, 10).map((match) => (
                <div key={match.id} className="summary-match">
                  <div className="summary-match__info">
                    <strong>{match.title}</strong>
                    <span className="summary-match__date">
                      {new Date(match.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <span className={`coverage-badge coverage-badge--${match.productionWorkflow?.coverageStatus || 'none'}`}>
                    {match.productionWorkflow?.coverageStatus === 'partial' ? '⚠️ Partial' : '❌ None'}
                  </span>
                </div>
              ))}
              {needingAttention.length > 10 && (
                <p className="summary-more">
                  ...and {needingAttention.length - 10} more match{needingAttention.length - 10 !== 1 ? 'es' : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
