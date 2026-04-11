'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { Gamepad2, Clock } from 'lucide-react'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

interface UpcomingMatch {
  id: number
  title: string
  date: string
  league?: string
  region?: string
  status: string
}

/**
 * Shows next 7 upcoming scheduled matches with date, title, and league info.
 */
export default function UpcomingMatchesWidget() {
  const { user } = useAuth<User>()
  const [matches, setMatches] = useState<UpcomingMatch[]>([])
  const [loading, setLoading] = useState(true)

  const role = (user?.role as string) ?? ''
  const canView = [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(role as UserRole)

  useEffect(() => {
    if (!canView) { setLoading(false); return }
    const now = new Date().toISOString()
    fetch(`/api/matches?where[date][greater_than]=${now}&where[status][equals]=scheduled&sort=date&limit=7&depth=1`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setMatches((data.docs ?? []).map((d: any) => ({
        id: d.id,
        title: d.title || 'Untitled Match',
        date: d.date,
        league: d.league,
        region: d.region,
        status: d.status,
      }))))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [canView])

  if (!canView) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const isToday = d.toDateString() === now.toDateString()
    const isTmrw = d.toDateString() === tomorrow.toDateString()
    const day = isToday ? 'Today' : isTmrw ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return { day, time, isToday, isTmrw }
  }

  const leagueColors: Record<string, string> = {
    Masters: '#ec4899',
    Expert: '#a855f7',
    Advanced: '#3b82f6',
    Open: '#10b981',
  }

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget__header">
        <Gamepad2 size={16} className="dashboard-widget__header-icon" />
        <h3 className="dashboard-widget__title">Upcoming Matches</h3>
        <span className="dashboard-widget__count">{matches.length}</span>
      </div>
      <div className="dashboard-widget__body">
        {loading ? (
          <div className="dashboard-widget__loading">Loading…</div>
        ) : matches.length === 0 ? (
          <div className="dashboard-widget__empty">No upcoming matches scheduled</div>
        ) : (
          <div className="dashboard-widget__list">
            {matches.map(m => {
              const { day, time, isToday, isTmrw } = formatDate(m.date)
              const lc = leagueColors[m.league ?? ''] ?? '#64748b'
              return (
                <Link key={m.id} href={`/admin/collections/matches/${m.id}`} className="dashboard-widget__row">
                  <div className="dashboard-widget__row-date">
                    <span className={`dashboard-widget__row-day ${isToday ? 'dashboard-widget__row-day--today' : isTmrw ? 'dashboard-widget__row-day--tomorrow' : ''}`}>{day}</span>
                    <span className="dashboard-widget__row-time"><Clock size={10} /> {time}</span>
                  </div>
                  <div className="dashboard-widget__row-content">
                    <span className="dashboard-widget__row-title">{m.title}</span>
                    <span className="dashboard-widget__row-meta">
                      {m.league && <span className="dashboard-widget__league-badge" style={{ color: lc, borderColor: `${lc}44` }}>{m.league}</span>}
                      {m.region && <span className="dashboard-widget__region">{m.region}</span>}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
