'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import { ClipboardList, AlertTriangle } from 'lucide-react'
import type { User } from '@/payload-types'

/**
 * Task Summary widget — aggregate counts of active tasks by status.
 */
export default function TaskSummaryWidget() {
  const { user } = useAuth<User>()
  const [counts, setCounts] = useState<{ backlog: number; inProgress: number; review: number; overdue: number; myTasks: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    const fetchCounts = async () => {
      try {
        const now = new Date().toISOString()
        const [backlogRes, inProgressRes, reviewRes, overdueRes, myRes] = await Promise.all([
          fetch('/api/tasks?where[status][equals]=backlog&where[archived][not_equals]=true&limit=0', { credentials: 'include' }),
          fetch('/api/tasks?where[status][equals]=in-progress&where[archived][not_equals]=true&limit=0', { credentials: 'include' }),
          fetch('/api/tasks?where[status][equals]=review&where[archived][not_equals]=true&limit=0', { credentials: 'include' }),
          fetch(`/api/tasks?where[dueDate][less_than]=${now}&where[status][not_equals]=complete&where[archived][not_equals]=true&limit=0`, { credentials: 'include' }),
          fetch(`/api/tasks?where[assignedTo][contains]=${user.id}&where[status][not_equals]=complete&where[archived][not_equals]=true&limit=0`, { credentials: 'include' }),
        ])
        const [backlogData, inProgressData, reviewData, overdueData, myData] = await Promise.all([
          backlogRes.json(), inProgressRes.json(), reviewRes.json(), overdueRes.json(), myRes.json(),
        ])
        setCounts({
          backlog: backlogData.totalDocs ?? 0,
          inProgress: inProgressData.totalDocs ?? 0,
          review: reviewData.totalDocs ?? 0,
          overdue: overdueData.totalDocs ?? 0,
          myTasks: myData.totalDocs ?? 0,
        })
      } catch {
        setCounts(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
  }, [user])

  if (!user) return null
  // If user gets 0 tasks (no access), don't show the widget at all
  if (!loading && counts && counts.backlog === 0 && counts.inProgress === 0 && counts.review === 0 && counts.myTasks === 0) return null

  const pills = counts ? [
    { label: 'Backlog', count: counts.backlog, color: '#64748b' },
    { label: 'In Progress', count: counts.inProgress, color: '#3b82f6' },
    { label: 'Review', count: counts.review, color: '#a855f7' },
    { label: 'My Tasks', count: counts.myTasks, color: '#06b6d4' },
  ] : []

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget__header">
        <ClipboardList size={16} className="dashboard-widget__header-icon" />
        <h3 className="dashboard-widget__title">Tasks</h3>
        {counts && counts.overdue > 0 && (
          <span className="dashboard-widget__overdue">
            <AlertTriangle size={12} /> {counts.overdue} overdue
          </span>
        )}
      </div>
      <div className="dashboard-widget__body">
        {loading ? (
          <div className="dashboard-widget__loading">Loading…</div>
        ) : !counts ? (
          <div className="dashboard-widget__empty">No active tasks</div>
        ) : (
          <div className="dashboard-task-pills">
            {pills.map(p => (
              <div key={p.label} className="dashboard-task-pill" style={{ '--pill-color': p.color } as React.CSSProperties}>
                <span className="dashboard-task-pill__count">{p.count}</span>
                <span className="dashboard-task-pill__label">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
