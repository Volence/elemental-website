'use client'

import React, { useState, useEffect } from 'react'
import { useField, useFormFields, useDocumentInfo } from '@payloadcms/ui'

import './index.scss'
import { Users } from 'lucide-react'

interface VoteData {
  date: string
  voterCount: number
  voters: Array<{
    id: string
    username: string
    displayName: string
    role?: string | null
  }>
  roleBreakdown?: Record<string, number> | null
}

interface CalendarResponse {
  discordId: string
  discordUsername: string
  selections: Record<string, Record<string, 'available' | 'maybe'>>
}

/** Extract short day labels from date strings like "Monday April 6th" */
function shortDay(dateStr: string): { day: string; date: string } {
  const parts = dateStr.split(' ')
  if (parts.length >= 3) {
    const dayAbbr = parts[0].substring(0, 3).toUpperCase()
    const month = parts[1].substring(0, 3)
    const num = parts[2].replace(/(st|nd|rd|th)$/i, '')
    return { day: dayAbbr, date: `${month} ${num}` }
  }
  return { day: dateStr.substring(0, 3), date: '' }
}

/** Build date label from Date object */
function dateLabel(date: Date): string {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  const dayNum = date.getDate()
  const suffix = ['th', 'st', 'nd', 'rd'][
    (dayNum % 10 > 3 || Math.floor((dayNum % 100) / 10) === 1) ? 0 : dayNum % 10
  ]
  return `${dayName} ${monthName} ${dayNum}${suffix}`
}

/** Build player availability matrix from calendar responses */
function buildCalendarMatrix(
  responses: CalendarResponse[],
  dateRange: { start: string; end: string },
): { allDates: string[]; players: Map<string, { name: string; days: Map<string, 'available' | 'maybe'> }>; dayCounts: Map<string, number> } {
  const startDate = dateRange.start.split('T')[0]
  const endDate = dateRange.end.split('T')[0]
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')

  const allDates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    allDates.push(dateLabel(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  const players = new Map<string, { name: string; days: Map<string, 'available' | 'maybe'> }>()
  const dayCounts = new Map<string, number>()

  // Build date key to label mapping
  const dateKeyToLabel = new Map<string, string>()
  const cursor2 = new Date(start)
  while (cursor2 <= end) {
    dateKeyToLabel.set(cursor2.toISOString().split('T')[0], dateLabel(cursor2))
    cursor2.setDate(cursor2.getDate() + 1)
  }

  for (const response of responses) {
    if (!players.has(response.discordId)) {
      players.set(response.discordId, {
        name: response.discordUsername,
        days: new Map(),
      })
    }
    const player = players.get(response.discordId)!

    for (const [dateKey, slots] of Object.entries(response.selections || {})) {
      const label = dateKeyToLabel.get(dateKey)
      if (!label) continue

      // Check best status across all time slots for this day
      let bestStatus: 'available' | 'maybe' | null = null
      for (const status of Object.values(slots)) {
        if (status === 'available') { bestStatus = 'available'; break }
        if (status === 'maybe') bestStatus = 'maybe'
      }

      if (bestStatus) {
        player.days.set(label, bestStatus)
        dayCounts.set(label, (dayCounts.get(label) || 0) + 1)
      }
    }
  }

  return { allDates, players, dayCounts }
}

export const VotesDisplay: React.FC<{ path: string }> = ({ path }) => {
  const { value } = useField<VoteData[] | null>({ path })
  const { id, collectionSlug } = useDocumentInfo()
  
  const scheduleTypeField = useFormFields(([fields]) => fields['scheduleType'])
  const scheduleType = (scheduleTypeField?.value as string) || 'poll'

  // For calendar types, fetch the raw response data
  const [calendarData, setCalendarData] = useState<{
    responses: CalendarResponse[]
    dateRange: { start: string; end: string }
    timeSlots: Array<{ startTime: string; label: string }>
  } | null>(null)

  useEffect(() => {
    if (scheduleType !== 'calendar' || !id) return

    const fetchCalendarData = async () => {
      try {
        const slug = collectionSlug || 'discord-polls'
        const res = await fetch(`/api/${slug}/${id}?depth=0`)
        if (!res.ok) return
        const doc = await res.json()
        const responses = doc.responses || []
        const start = doc.dateRange?.start
        const end = doc.dateRange?.end
        const timeSlots = (doc.timeSlots || []).map((s: any) => ({
          startTime: s.startTime,
          label: s.label,
        }))
        if (start && end && responses.length > 0) {
          setCalendarData({ responses, dateRange: { start, end }, timeSlots })
        }
      } catch {
        // Silently fail
      }
    }
    fetchCalendarData()
  }, [scheduleType, id, collectionSlug])

  // Calendar type: build per-slot matrix from calendar responses
  if (scheduleType === 'calendar') {
    if (!calendarData) return null

    const { responses, dateRange, timeSlots } = calendarData
    const startDate = dateRange.start.split('T')[0]
    const endDate = dateRange.end.split('T')[0]
    const start = new Date(startDate + 'T12:00:00')
    const end = new Date(endDate + 'T12:00:00')

    // Build dates
    const dates: Array<{ key: string; label: string; shortLabel: { day: string; date: string } }> = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const label = dateLabel(cursor)
      dates.push({
        key: cursor.toISOString().split('T')[0],
        label,
        shortLabel: shortDay(label),
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    // Build slot keys from configured time slots
    const slotKeys = timeSlots.length > 0
      ? timeSlots.map(s => ({ key: s.startTime, label: s.label }))
      : (() => {
          const discovered = new Set<string>()
          for (const r of responses) {
            for (const daySlots of Object.values(r.selections || {})) {
              for (const k of Object.keys(daySlots)) discovered.add(k)
            }
          }
          return Array.from(discovered).sort().map(k => ({ key: k, label: k }))
        })()

    // Build player data: player → date → slot → status
    const playerMap = new Map<string, {
      name: string
      slots: Map<string, 'available' | 'maybe'> // key: "dateKey|slotKey"
    }>()

    for (const r of responses) {
      if (!playerMap.has(r.discordId)) {
        playerMap.set(r.discordId, { name: r.discordUsername, slots: new Map() })
      }
      const player = playerMap.get(r.discordId)!
      for (const [dateKey, daySlots] of Object.entries(r.selections || {})) {
        for (const [slotKey, status] of Object.entries(daySlots)) {
          if (status === 'available' || status === 'maybe') {
            player.slots.set(`${dateKey}|${slotKey}`, status)
          }
        }
      }
    }

    if (playerMap.size === 0) return null

    const sortedPlayers = Array.from(playerMap.entries())
      .sort(([, a], [, b]) => b.slots.size - a.slots.size)

    const totalCells = dates.length * slotKeys.length

    return (
      <div className="votes-display">
        <div className="votes-display__header">
          <span className="votes-display__header-icon"><Users size={14} /></span>
          <span className="votes-display__header-title">Player Availability</span>
          <span className="votes-display__header-count">
            {playerMap.size} player{playerMap.size !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="votes-display__matrix votes-display__matrix--slotted">
          {/* Column headers: Day names with slot sub-headers */}
          <div className="votes-display__matrix-header">
            <div className="votes-display__matrix-player-col">Player</div>
            {dates.map(d => (
              <div key={d.key} className="votes-display__matrix-day-group" style={{ flex: `0 0 ${slotKeys.length * 32}px` }}>
                <div className="votes-display__matrix-day-label">
                  <span className="votes-display__matrix-day-name">{d.shortLabel.day}</span>
                  <span className="votes-display__matrix-day-date">{d.shortLabel.date}</span>
                </div>
                <div className="votes-display__matrix-slot-headers">
                  {slotKeys.map(s => (
                    <div key={s.key} className="votes-display__matrix-slot-header">
                      {s.label.replace(/ PM| AM/gi, '').replace(/ EST/gi, '')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="votes-display__matrix-total-col">Total</div>
          </div>

          {/* Player rows */}
          {sortedPlayers.map(([id, player]) => {
            const availCount = player.slots.size
            const coverage = availCount / totalCells
            const isLow = coverage < 0.3

            return (
              <div key={id} className={`votes-display__matrix-row ${isLow ? 'votes-display__matrix-row--low' : ''}`}>
                <div className="votes-display__matrix-player-col">
                  <span className="votes-display__matrix-player-name">{player.name}</span>
                </div>
                {dates.map(d => (
                  <div key={d.key} className="votes-display__matrix-slot-cells" style={{ flex: `0 0 ${slotKeys.length * 32}px` }}>
                    {slotKeys.map(s => {
                      const status = player.slots.get(`${d.key}|${s.key}`)
                      return (
                        <div
                          key={s.key}
                          className={`votes-display__matrix-slot-cell ${status === 'available' ? 'votes-display__matrix-slot-cell--available' : ''} ${status === 'maybe' ? 'votes-display__matrix-slot-cell--maybe' : ''}`}
                        >
                          {status === 'available' && <span className="votes-display__matrix-check">✓</span>}
                          {status === 'maybe' && <span className="votes-display__matrix-maybe">?</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div className={`votes-display__matrix-total-col ${isLow ? 'votes-display__matrix-total--low' : ''}`}>
                  {availCount}/{totalCells}
                </div>
              </div>
            )
          })}

          {/* Totals row */}
          <div className="votes-display__matrix-row votes-display__matrix-row--totals">
            <div className="votes-display__matrix-player-col">
              <span className="votes-display__matrix-player-name votes-display__matrix-totals-label">Total</span>
            </div>
            {dates.map(d => (
              <div key={d.key} className="votes-display__matrix-slot-cells" style={{ flex: `0 0 ${slotKeys.length * 32}px` }}>
                {slotKeys.map(s => {
                  let count = 0
                  for (const [, player] of playerMap) {
                    if (player.slots.has(`${d.key}|${s.key}`)) count++
                  }
                  return (
                    <div key={s.key} className="votes-display__matrix-slot-cell votes-display__matrix-slot-cell--total">
                      {count}
                    </div>
                  )
                })}
              </div>
            ))}
            <div className="votes-display__matrix-total-col" />
          </div>
        </div>
      </div>
    )
  }

  // Poll type: build matrix from poll votes
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="votes-display votes-display--empty">
        <div className="votes-display__empty-message">
          <span className="votes-display__empty-icon"><Users size={14} /></span>
          <p>No votes synced yet.</p>
          <p className="votes-display__empty-hint">
            Click <strong>&quot;View Results&quot;</strong> on the poll in Discord to sync votes.
          </p>
        </div>
      </div>
    )
  }

  const allPlayers = new Map<string, { name: string; days: Map<string, 'available' | 'maybe'> }>()
  const allDates = value.map(v => v.date)
  const dayCounts = new Map<string, number>()

  for (const day of value) {
    dayCounts.set(day.date, day.voterCount)
    for (const voter of day.voters) {
      if (!allPlayers.has(voter.id)) {
        allPlayers.set(voter.id, {
          name: voter.displayName || voter.username,
          days: new Map(),
        })
      }
      allPlayers.get(voter.id)!.days.set(day.date, 'available')
    }
  }

  if (allPlayers.size === 0) {
    return (
      <div className="votes-display votes-display--empty">
        <div className="votes-display__empty-message">
          <span className="votes-display__empty-icon"><Users size={14} /></span>
          <p>No availability data yet.</p>
        </div>
      </div>
    )
  }

  const sortedPlayers = Array.from(allPlayers.entries())
    .sort(([, a], [, b]) => b.days.size - a.days.size)

  return (
    <div className="votes-display">
      <div className="votes-display__header">
        <span className="votes-display__header-icon"><Users size={14} /></span>
        <span className="votes-display__header-title">Player Availability</span>
        <span className="votes-display__header-count">
          {allPlayers.size} player{allPlayers.size !== 1 ? 's' : ''}
        </span>
      </div>
      <PlayerMatrix
        allDates={allDates}
        players={sortedPlayers.map(([id, p]) => ({
          id,
          name: p.name,
          days: p.days,
        }))}
        dayCounts={dayCounts}
        totalDays={allDates.length}
        isCalendar={false}
      />
    </div>
  )
}

/** Shared matrix component */
const PlayerMatrix: React.FC<{
  allDates: string[]
  players: Array<{ id: string; name: string; days: Map<string, 'available' | 'maybe'> }>
  dayCounts: Map<string, number>
  totalDays: number
  isCalendar: boolean
}> = ({ allDates, players, dayCounts, totalDays, isCalendar }) => {
  return (
    <div className="votes-display__matrix">
      {/* Column headers */}
      <div className="votes-display__matrix-header">
        <div className="votes-display__matrix-player-col">Player</div>
        {allDates.map((date) => {
          const { day, date: dateStr } = shortDay(date)
          return (
            <div key={date} className="votes-display__matrix-day-col">
              <span className="votes-display__matrix-day-name">{day}</span>
              <span className="votes-display__matrix-day-date">{dateStr}</span>
            </div>
          )
        })}
        <div className="votes-display__matrix-total-col">Total</div>
      </div>

      {/* Player rows */}
      {players.map(({ id, name, days }) => {
        const availCount = days.size
        const coverage = availCount / totalDays
        const isLow = coverage < 0.4

        return (
          <div
            key={id}
            className={`votes-display__matrix-row ${isLow ? 'votes-display__matrix-row--low' : ''}`}
          >
            <div className="votes-display__matrix-player-col">
              <span className="votes-display__matrix-player-name">{name}</span>
            </div>
            {allDates.map((date) => {
              const status = days.get(date)
              return (
                <div
                  key={date}
                  className={`votes-display__matrix-cell ${status === 'available' ? 'votes-display__matrix-cell--available' : ''} ${status === 'maybe' ? 'votes-display__matrix-cell--maybe' : ''}`}
                >
                  {status === 'available' && <span className="votes-display__matrix-check">✓</span>}
                  {status === 'maybe' && <span className="votes-display__matrix-maybe">?</span>}
                </div>
              )
            })}
            <div className={`votes-display__matrix-total-col ${isLow ? 'votes-display__matrix-total--low' : ''}`}>
              {availCount}/{totalDays}
            </div>
          </div>
        )
      })}

      {/* Day totals row */}
      <div className="votes-display__matrix-row votes-display__matrix-row--totals">
        <div className="votes-display__matrix-player-col">
          <span className="votes-display__matrix-player-name votes-display__matrix-totals-label">Total</span>
        </div>
        {allDates.map((date) => {
          const count = dayCounts.get(date) || 0
          return (
            <div key={date} className="votes-display__matrix-cell votes-display__matrix-cell--total">
              {count}
            </div>
          )
        })}
        <div className="votes-display__matrix-total-col" />
      </div>
    </div>
  )
}

export default VotesDisplay
