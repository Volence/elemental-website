'use client'

import React, { useState, useMemo } from 'react'
import { Check, HelpCircle, Minus, XCircle, Users } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import './AvailabilityMatrix.css'

const ROLE_ABBREV: Record<string, string> = {
  tank: 'T',
  dps: 'DPS',
  support: 'SUP',
}

const ROLE_CLASS: Record<string, string> = {
  tank: 'role-badge--tank',
  dps: 'role-badge--dps',
  support: 'role-badge--support',
}

interface PlayerRow {
  discordId: string
  name: string
  avatar?: string
  role: string
  roleClass: string
  roleAbbrev: string
  isOnRoster: boolean
  isSub: boolean
  responded: boolean
  selections: Record<string, Record<string, 'available' | 'maybe'>>
}

export function AvailabilityMatrix() {
  const { data } = useSchedule()
  const { activeCalendar, team, absences } = data
  const [activeFilter, setActiveFilter] = useState<string>('all')

  if (!activeCalendar) {
    return (
      <div className="avail-matrix avail-matrix--empty">
        <Users size={28} />
        <p>No active calendar to display team availability.</p>
      </div>
    )
  }

  const timeSlots = activeCalendar.timeSlots || []
  const dateRange = activeCalendar.dateRange || {}
  const responses = (activeCalendar.responses || []) as any[]
  const scheduleBlocks = team.scheduleBlocks || []

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
        rows.push({
          discordId: person.discordId,
          name: person.name || response?.discordUsername || 'Unknown',
          avatar: person.discordAvatar || response?.discordAvatar,
          role: entry.role || 'dps',
          roleClass: ROLE_CLASS[entry.role] || 'role-badge--dps',
          roleAbbrev: ROLE_ABBREV[entry.role] || 'DPS',
          isOnRoster: !isSub,
          isSub,
          responded: !!response,
          selections: response?.selections || {},
        })
      }
    }

    addFromRoster(team.roster, false)
    addFromRoster(team.subs, true)

    // Add any responders not on the roster
    for (const response of responses) {
      if (!seenIds.has(response.discordId)) {
        seenIds.add(response.discordId)
        rows.push({
          discordId: response.discordId,
          name: response.discordUsername || 'Unknown',
          avatar: response.discordAvatar,
          role: 'dps',
          roleClass: 'role-badge--dps',
          roleAbbrev: '?',
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

  const totalRoster = team.roster.length + team.subs.length
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

  if (dates.length === 0 || timeSlots.length === 0) return null

  return (
    <div className="avail-matrix">
      <div className="avail-matrix__header">
        <div className="avail-matrix__header-left">
          <Users size={20} />
          <h3 className="avail-matrix__title">Team Availability</h3>
        </div>
        <div className="avail-matrix__response-count">
          {respondedCount} of {totalRoster} responded
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

      <div className="avail-matrix__grid-wrapper">
        <table className="avail-matrix__grid">
          <thead>
            <tr>
              <th className="avail-matrix__player-header">Player</th>
              {dates.map(date => (
                filteredSlots.map((slot: any) => (
                  <th key={`${date}-${slot.startTime}`} className="avail-matrix__slot-header">
                    <span className="avail-matrix__slot-day">{getDayLabel(date)}</span>
                    <span className="avail-matrix__slot-date">{getDateLabel(date)}</span>
                    <span className="avail-matrix__slot-time">{slot.label}</span>
                    <span className="avail-matrix__slot-count">[{slotCounts[`${date}-${slot.startTime}`] || 0}]</span>
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {playerRows.map(player => (
              <tr key={player.discordId} className={`avail-matrix__row ${!player.responded ? 'avail-matrix__row--no-response' : ''}`}>
                <td className="avail-matrix__player-cell">
                  <div className="avail-matrix__player-info">
                    {player.avatar && (
                      <img src={player.avatar} alt="" className="avail-matrix__player-avatar" width={20} height={20} />
                    )}
                    <span className="avail-matrix__player-name">{player.name}</span>
                    <span className={`avail-matrix__role-badge ${player.roleClass}`}>{player.roleAbbrev}</span>
                    {player.isSub && <span className="avail-matrix__sub-badge">SUB</span>}
                  </div>
                </td>
                {dates.map(date => {
                  const isAbsent = absentDatesByPlayer[player.discordId]?.has(date)
                  return filteredSlots.map((slot: any) => {
                    const status = isAbsent ? 'absent' : (player.selections[date]?.[slot.startTime] || null)
                    return (
                      <td key={`${player.discordId}-${date}-${slot.startTime}`} className={`avail-matrix__cell avail-matrix__cell--${status || 'none'}`}>
                        {status === 'available' && <Check size={14} strokeWidth={3} />}
                        {status === 'maybe' && <HelpCircle size={12} />}
                        {status === 'absent' && <XCircle size={12} />}
                        {status === null && player.responded && <Minus size={12} />}
                      </td>
                    )
                  })
                })}
              </tr>
            ))}
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
    </div>
  )
}
