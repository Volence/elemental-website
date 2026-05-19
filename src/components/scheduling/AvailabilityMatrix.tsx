'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Check, HelpCircle, Minus, XCircle, Users } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import './AvailabilityMatrix.css'

interface RoleOption {
  label: string
  abbrev: string
  color: string
}

const SPECIFIC_ROLES: RoleOption[] = [
  { label: 'Tank', abbrev: 'T', color: '#00e5ff' },
  { label: 'Hitscan', abbrev: 'HS', color: '#ff3e8a' },
  { label: 'Flex DPS', abbrev: 'FDPS', color: '#ff9f1c' },
  { label: 'Main Support', abbrev: 'MS', color: '#00ff9f' },
  { label: 'Flex Support', abbrev: 'FS', color: '#b44dff' },
  { label: 'Coach', abbrev: 'Coach', color: '#94a3b8' },
]

const GENERIC_ROLES: RoleOption[] = [
  { label: 'Tank', abbrev: 'T', color: '#00e5ff' },
  { label: 'DPS', abbrev: 'DPS', color: '#ff3e8a' },
  { label: 'Support', abbrev: 'SUP', color: '#00ff9f' },
  { label: 'Coach', abbrev: 'Coach', color: '#94a3b8' },
]

const CUSTOM_COLORS = ['#00e5ff', '#ff3e8a', '#ff9f1c', '#00ff9f', '#b44dff', '#f59e0b', '#ec4899', '#06b6d4']

function getRoleOptions(team: any): RoleOption[] {
  const preset = team.rolePreset || 'specific'
  if (preset === 'generic') return GENERIC_ROLES
  if (preset === 'custom' && team.customRoles) {
    return team.customRoles.split(',').map((r: string, i: number) => {
      const label = r.trim()
      const abbrev = label.length <= 4 ? label.toUpperCase() : label.slice(0, 3).toUpperCase()
      return { label, abbrev, color: CUSTOM_COLORS[i % CUSTOM_COLORS.length] }
    }).filter((r: RoleOption) => r.label)
  }
  return SPECIFIC_ROLES
}

const ROSTER_ROLE_MAP: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
}

interface PlayerRow {
  discordId: string
  name: string
  avatar?: string
  scheduleRole: string
  scheduleStatus: string
  isOnRoster: boolean
  isSub: boolean
  responded: boolean
  selections: Record<string, Record<string, 'available' | 'maybe'>>
}

export function AvailabilityMatrix() {
  const { data, refreshData, viewedCalendar } = useSchedule()
  const { team, absences, authState } = data
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [roleModal, setRoleModal] = useState<{ discordId: string; name: string; avatar?: string; currentRole: string; currentStatus: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileDay, setMobileDay] = useState<string | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const roleOptions = useMemo(() => getRoleOptions(team), [team.rolePreset, team.customRoles])

  if (!viewedCalendar) {
    return (
      <div className="avail-matrix avail-matrix--empty">
        <Users size={28} />
        <p>No active calendar to display team availability.</p>
      </div>
    )
  }

  const scheduleBlocks = team.scheduleBlocks || []
  const fallbackSlots = scheduleBlocks.map((b: any) => ({
    id: b.id || `block_${b.startTime}`,
    label: b.label,
    startTime: b.startTime,
    endTime: b.endTime,
  }))
  const timeSlots = viewedCalendar.timeSlots?.length ? viewedCalendar.timeSlots : fallbackSlots
  const dateRange = viewedCalendar.dateRange || {}
  const responses = (viewedCalendar.responses || []) as any[]

  const dates = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return []
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    const days: string[] = []
    const current = new Date(start)
    while (current <= end) {
      days.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return days
  }, [dateRange])

  const filteredSlots = useMemo(() => {
    if (activeFilter === 'all') return timeSlots
    const block = scheduleBlocks.find((b: any) => b.label === activeFilter)
    if (!block) return timeSlots
    return timeSlots.filter((slot: any) => slot.startTime === block.startTime)
  }, [activeFilter, timeSlots, scheduleBlocks])

  const absentDatesByPlayer = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    absences
      .filter((a: any) => a.type === 'absence')
      .forEach((a: any) => {
        if (!map[a.discordId]) map[a.discordId] = new Set()
        const start = new Date(a.startDate)
        const end = new Date(a.endDate)
        const current = new Date(start)
        while (current <= end) {
          map[a.discordId].add(current.toISOString().split('T')[0])
          current.setDate(current.getDate() + 1)
        }
      })
    return map
  }, [absences])

  const playerRows: PlayerRow[] = useMemo(() => {
    const rows: PlayerRow[] = []
    const seenIds = new Set<string>()

    const addFromRoster = (entries: any[], isSub: boolean) => {
      for (const entry of entries) {
        const person = entry.person
        if (!person?.discordId || seenIds.has(person.discordId)) continue
        seenIds.add(person.discordId)
        const response = responses.find((r: any) => r.discordId === person.discordId)
        const scheduleRole = response?.scheduleRole || ROSTER_ROLE_MAP[entry.role] || ''
        const defaultStatus = isSub ? 'sub' : 'main'
        rows.push({
          discordId: person.discordId,
          name: person.name || response?.discordUsername || 'Unknown',
          avatar: person.discordAvatar || response?.discordAvatar,
          scheduleRole,
          scheduleStatus: response?.scheduleStatus || defaultStatus,
          isOnRoster: !isSub,
          isSub,
          responded: !!response,
          selections: response?.selections || {},
        })
      }
    }

    addFromRoster(team.roster, false)
    addFromRoster(team.subs, true)

    for (const response of responses) {
      if (!seenIds.has(response.discordId)) {
        seenIds.add(response.discordId)
        rows.push({
          discordId: response.discordId,
          name: response.discordUsername || 'Unknown',
          avatar: response.discordAvatar,
          scheduleRole: response.scheduleRole || '',
          scheduleStatus: response.scheduleStatus || 'main',
          isOnRoster: false,
          isSub: false,
          responded: true,
          selections: response.selections || {},
        })
      }
    }

    return rows
  }, [team.roster, team.subs, responses])

  const slotCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const date of dates) {
      for (const slot of filteredSlots) {
        const key = `${date}-${slot.startTime}`
        counts[key] = playerRows.filter(p => {
          const status = p.selections[date]?.[slot.startTime]
          return status === 'available' || status === 'maybe'
        }).length
      }
    }
    return counts
  }, [dates, filteredSlots, playerRows])

  const totalPlayers = playerRows.length
  const respondedCount = playerRows.filter(p => p.responded).length
  const notResponded = playerRows.filter(p => !p.responded)

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function resolveRoleDisplay(scheduleRole: string): { abbrev: string; color: string } {
    if (!scheduleRole) return { abbrev: '', color: '' }
    const match = roleOptions.find(r => r.label === scheduleRole)
    if (match) return { abbrev: match.abbrev, color: match.color }
    return { abbrev: scheduleRole.length <= 4 ? scheduleRole.toUpperCase() : scheduleRole.slice(0, 3).toUpperCase(), color: '#94a3b8' }
  }

  async function handleRoleUpdate(discordId: string, role: string) {
    setRoleModal(null)
    try {
      const res = await fetch(`/api/schedule/${team.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRole', discordId, scheduleRole: role, calendarId: viewedCalendar.id }),
      })
      if (res.ok) await refreshData()
    } catch (err) {
      console.error('Failed to update role:', err)
    }
  }

  async function handleStatusUpdate(discordId: string, status: string) {
    setRoleModal(null)
    try {
      const res = await fetch(`/api/schedule/${team.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRole', discordId, scheduleStatus: status, calendarId: viewedCalendar.id }),
      })
      if (res.ok) await refreshData()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  // Default mobile day to today or nearest available date
  useEffect(() => {
    if (!isMobile || dates.length === 0) return
    if (mobileDay && dates.includes(mobileDay)) return
    const today = new Date().toISOString().split('T')[0]
    setMobileDay(dates.includes(today) ? today : dates[0])
  }, [isMobile, dates, mobileDay])

  const displayDates = useMemo(() => {
    if (!isMobile || !mobileDay) return dates
    return dates.filter(d => d === mobileDay)
  }, [isMobile, mobileDay, dates])

  if (dates.length === 0 || timeSlots.length === 0) return null

  return (
    <div className="avail-matrix">
      <div className="avail-matrix__header">
        <div className="avail-matrix__header-left">
          <Users size={20} />
          <h3 className="avail-matrix__title">Team Availability</h3>
        </div>
        <div className="avail-matrix__response-count">
          {respondedCount} of {totalPlayers} responded
        </div>
      </div>

      {scheduleBlocks.length > 1 && (
        <div className="avail-matrix__filters">
          <button
            className={`avail-matrix__filter-btn ${activeFilter === 'all' ? 'avail-matrix__filter-btn--active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          {scheduleBlocks.map((block: any) => (
            <button
              key={block.label}
              className={`avail-matrix__filter-btn ${activeFilter === block.label ? 'avail-matrix__filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(block.label)}
            >
              {block.label}
            </button>
          ))}
        </div>
      )}

      {isMobile && dates.length > 1 && (
        <div className="avail-matrix__day-nav">
          {dates.map(date => {
            const today = new Date().toISOString().split('T')[0]
            return (
              <button
                key={date}
                className={`avail-matrix__day-nav-btn${mobileDay === date ? ' avail-matrix__day-nav-btn--active' : ''}${date === today ? ' avail-matrix__day-nav-btn--today' : ''}`}
                onClick={() => setMobileDay(date)}
              >
                <span className="avail-matrix__day-nav-weekday">{getDayLabel(date)}</span>
                <span className="avail-matrix__day-nav-date">{getDateLabel(date)}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="avail-matrix__grid-wrapper">
        <table className="avail-matrix__grid">
          <thead>
            {!isMobile && (
              <tr className="avail-matrix__day-row">
                <th className="avail-matrix__player-header" rowSpan={2}>Player</th>
                {displayDates.map(date => (
                  <th key={date} className="avail-matrix__day-header" colSpan={filteredSlots.length}>
                    <span className="avail-matrix__day-name">{getDayLabel(date)}</span>
                    <span className="avail-matrix__day-date">{getDateLabel(date)}</span>
                  </th>
                ))}
              </tr>
            )}
            <tr className="avail-matrix__time-row">
              {isMobile && <th className="avail-matrix__player-header">Player</th>}
              {displayDates.map(date => (
                filteredSlots.map((slot: any, si: number) => (
                  <th key={`${date}-${slot.startTime}`} className={`avail-matrix__slot-header${si === 0 ? ' avail-matrix__slot-header--day-start' : ''}`}>
                    <span className="avail-matrix__slot-time">{slot.label}</span>
                    <span className="avail-matrix__slot-count">[{slotCounts[`${date}-${slot.startTime}`] || 0}]</span>
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {playerRows.map(player => {
              const { abbrev, color: roleColor } = resolveRoleDisplay(player.scheduleRole)
              const isSelf = authState.discordUser?.id === player.discordId
              const canEditRole = authState.isManager || isSelf

              return (
                <tr key={player.discordId} className={`avail-matrix__row ${!player.responded ? 'avail-matrix__row--no-response' : ''}`}>
                  <td className="avail-matrix__player-cell">
                    <div className="avail-matrix__player-info">
                      {player.avatar && (
                        <img src={player.avatar} alt="" className="avail-matrix__player-avatar" width={20} height={20} />
                      )}
                      <span className="avail-matrix__player-name">{player.name}</span>
                      {canEditRole ? (
                        <button
                          className="avail-matrix__role-badge avail-matrix__role-badge--clickable"
                          style={roleColor ? { background: `${roleColor}20`, color: roleColor } : undefined}
                          onClick={() => setRoleModal({ discordId: player.discordId, name: player.name, avatar: player.avatar, currentRole: player.scheduleRole, currentStatus: player.scheduleStatus })}
                        >
                          {abbrev || 'No Role'}
                        </button>
                      ) : (
                        abbrev && <span className="avail-matrix__role-badge" style={{ background: `${roleColor}20`, color: roleColor }}>{abbrev}</span>
                      )}
                      {player.isSub && <span className="avail-matrix__sub-badge">SUB</span>}
                      {player.scheduleStatus === 'tryout' && <span className="avail-matrix__tryout-badge">TRIAL</span>}
                    </div>
                  </td>
                  {displayDates.map(date => {
                    const isAbsent = absentDatesByPlayer[player.discordId]?.has(date)
                    return filteredSlots.map((slot: any, si: number) => {
                      const status = isAbsent ? 'absent' : (player.selections[date]?.[slot.startTime] || null)
                      return (
                        <td key={`${player.discordId}-${date}-${slot.startTime}`} className={`avail-matrix__cell avail-matrix__cell--${status || 'none'}${si === 0 ? ' avail-matrix__cell--day-start' : ''}`}>
                          {status === 'available' && <Check size={14} strokeWidth={3} />}
                          {status === 'maybe' && <HelpCircle size={12} />}
                          {status === 'absent' && <XCircle size={12} />}
                          {status === null && player.responded && <Minus size={12} />}
                        </td>
                      )
                    })
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {notResponded.length > 0 && (
        <div className="avail-matrix__missing">
          <span className="avail-matrix__missing-label">Not responded:</span>
          {notResponded.map(p => (
            <span key={p.discordId} className="avail-matrix__missing-name">{p.name}</span>
          ))}
        </div>
      )}

      {roleModal && (
        <div className="avail-matrix__modal-overlay" onClick={() => setRoleModal(null)}>
          <div className="avail-matrix__modal" onClick={e => e.stopPropagation()}>
            <div className="avail-matrix__modal-header">
              {roleModal.avatar && (
                <img src={roleModal.avatar} alt="" className="avail-matrix__modal-avatar" width={32} height={32} />
              )}
              <span className="avail-matrix__modal-name">{roleModal.name}</span>
            </div>
            <div className="avail-matrix__modal-options">
              {roleOptions.map(opt => (
                <button
                  key={opt.label}
                  className={`avail-matrix__role-option ${roleModal.currentRole === opt.label ? 'avail-matrix__role-option--active' : ''}`}
                  onClick={() => handleRoleUpdate(roleModal.discordId, opt.label)}
                >
                  <span className="avail-matrix__role-option-dot" style={{ background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
            {roleModal.currentRole && (
              <button
                className="avail-matrix__role-option avail-matrix__role-option--clear"
                onClick={() => handleRoleUpdate(roleModal.discordId, '')}
              >
                Clear Role
              </button>
            )}
            {authState.isManager && (
              <>
                <div className="avail-matrix__modal-divider" />
                <span className="avail-matrix__modal-section-label">Status</span>
                <div className="avail-matrix__modal-options">
                  {(['main', 'tryout', 'sub'] as const).map(s => (
                    <button
                      key={s}
                      className={`avail-matrix__role-option ${roleModal.currentStatus === s ? 'avail-matrix__role-option--active' : ''}`}
                      onClick={() => handleStatusUpdate(roleModal.discordId, s)}
                    >
                      <span className="avail-matrix__role-option-dot" style={{ background: s === 'main' ? '#00e5ff' : s === 'tryout' ? '#fbbf24' : '#94a3b8' }} />
                      {s === 'main' ? 'Main' : s === 'tryout' ? 'Tryout' : 'Sub'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="avail-matrix__modal-cancel" onClick={() => setRoleModal(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
