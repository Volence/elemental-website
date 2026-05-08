'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Calendar, Check, Minus, HelpCircle, Save, CheckCircle, Loader2, XCircle, LogIn } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import './AvailabilityVoting.css'

type CellStatus = 'available' | 'maybe' | null

export function AvailabilityVoting() {
  const { data, refreshData } = useSchedule()
  const { activeCalendar, authState, absences, team } = data

  if (!activeCalendar) {
    return (
      <div className="avail-voting avail-voting--empty">
        <Calendar size={32} />
        <p>No active availability calendar for this week.</p>
      </div>
    )
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="avail-voting avail-voting--auth">
        <div className="avail-voting__auth-prompt">
          <LogIn size={24} />
          <p>Sign in with Discord to submit your availability.</p>
          <a
            href={`/api/schedule-auth?teamSlug=${team.slug}`}
            className="avail-voting__auth-btn"
          >
            Sign in with Discord
          </a>
        </div>
      </div>
    )
  }

  return (
    <AvailabilityVotingGrid
      calendar={activeCalendar}
      authState={authState}
      absences={absences}
      teamSlug={team.slug}
      onSaved={refreshData}
    />
  )
}

function AvailabilityVotingGrid({
  calendar,
  authState,
  absences,
  teamSlug,
  onSaved,
}: {
  calendar: any
  authState: any
  absences: any[]
  teamSlug: string
  onSaved: () => Promise<void>
}) {
  const timeSlots = calendar.timeSlots || []
  const dateRange = calendar.dateRange || {}
  const isClosed = calendar.status === 'closed'

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

  const existingResponse = useMemo(() => {
    if (!calendar.responses || !authState.discordUser) return null
    return (calendar.responses as any[]).find(
      (r: any) => r.discordId === authState.discordUser.id
    ) || null
  }, [calendar.responses, authState.discordUser])

  const [selections, setSelections] = useState<Record<string, Record<string, CellStatus>>>(() => {
    const init: Record<string, Record<string, CellStatus>> = {}
    dates.forEach(date => {
      init[date] = {}
      timeSlots.forEach((slot: any) => {
        const existing = existingResponse?.selections?.[date]?.[slot.startTime]
        init[date][slot.startTime] = existing || null
      })
    })
    return init
  })

  const [notes, setNotes] = useState(existingResponse?.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userAbsenceDates = useMemo(() => {
    if (!authState.discordUser) return new Set<string>()
    const absentDates = new Set<string>()
    absences
      .filter((a: any) => a.discordId === authState.discordUser.id && a.type === 'absence')
      .forEach((a: any) => {
        const start = new Date(a.startDate)
        const end = new Date(a.endDate)
        const current = new Date(start)
        while (current <= end) {
          absentDates.add(current.toISOString().split('T')[0])
          current.setDate(current.getDate() + 1)
        }
      })
    return absentDates
  }, [absences, authState.discordUser])

  const cycleCell = useCallback((date: string, slotStartTime: string) => {
    if (isClosed || userAbsenceDates.has(date)) return
    setSelections(prev => {
      const current = prev[date]?.[slotStartTime]
      let next: CellStatus
      if (current === null || current === undefined) next = 'available'
      else if (current === 'available') next = 'maybe'
      else next = null
      return { ...prev, [date]: { ...prev[date], [slotStartTime]: next } }
    })
    setSaved(false)
  }, [isClosed, userAbsenceDates])

  const toggleFillAll = useCallback((date: string) => {
    if (isClosed || userAbsenceDates.has(date)) return
    setSelections(prev => {
      const daySlots = prev[date] || {}
      const allAvailable = timeSlots.every((slot: any) => daySlots[slot.startTime] === 'available')
      const allMaybe = timeSlots.every((slot: any) => daySlots[slot.startTime] === 'maybe')
      let nextStatus: CellStatus
      if (allAvailable) nextStatus = 'maybe'
      else if (allMaybe) nextStatus = null
      else nextStatus = 'available'
      const newDay: Record<string, CellStatus> = {}
      timeSlots.forEach((slot: any) => { newDay[slot.startTime] = nextStatus })
      return { ...prev, [date]: newDay }
    })
    setSaved(false)
  }, [isClosed, timeSlots, userAbsenceDates])

  const getFillAllState = useCallback((date: string): CellStatus => {
    const daySlots = selections[date] || {}
    if (timeSlots.every((slot: any) => daySlots[slot.startTime] === 'available')) return 'available'
    if (timeSlots.every((slot: any) => daySlots[slot.startTime] === 'maybe')) return 'maybe'
    return null
  }, [selections, timeSlots])

  const handleSave = async (notAvailable?: boolean) => {
    setSaving(true)
    setError(null)
    const cleanSelections: Record<string, Record<string, 'available' | 'maybe'>> = {}
    if (!notAvailable) {
      Object.entries(selections).forEach(([date, slots]) => {
        Object.entries(slots).forEach(([slotTime, status]) => {
          if (status) {
            if (!cleanSelections[date]) cleanSelections[date] = {}
            cleanSelections[date][slotTime] = status
          }
        })
      })
    }
    try {
      const res = await fetch(`/api/availability/${calendar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: notAvailable ? {} : cleanSelections,
          notes: notes.trim() || undefined,
          ...(notAvailable ? { notAvailable: true } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  const handleNotAvailable = async () => {
    setSelections(prev => {
      const cleared: Record<string, Record<string, CellStatus>> = {}
      dates.forEach(date => {
        cleared[date] = {}
        timeSlots.forEach((slot: any) => { cleared[date][slot.startTime] = null })
      })
      return cleared
    })
    await handleSave(true)
  }

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getTimezoneLabel = (tz: string) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      const parts = formatter.formatToParts(new Date())
      return parts.find(p => p.type === 'timeZoneName')?.value || tz
    } catch { return tz }
  }

  const getCellClass = (status: CellStatus) => {
    if (status === 'available') return 'avail-voting__cell--available'
    if (status === 'maybe') return 'avail-voting__cell--maybe'
    return 'avail-voting__cell--empty'
  }

  const getCellIcon = (status: CellStatus) => {
    if (status === 'available') return <Check size={18} strokeWidth={3} />
    if (status === 'maybe') return <HelpCircle size={16} />
    return null
  }

  if (dates.length === 0 || timeSlots.length === 0) {
    return (
      <div className="avail-voting avail-voting--empty">
        <p>This calendar is missing date or time slot configuration.</p>
      </div>
    )
  }

  const timezone = calendar.scheduleTimezone || 'America/New_York'

  return (
    <div className="avail-voting">
      <div className="avail-voting__header">
        <div className="avail-voting__header-top">
          <Calendar size={24} />
          <div>
            <h2 className="avail-voting__title">{calendar.pollName || 'Weekly Availability'}</h2>
          </div>
        </div>
        <div className="avail-voting__meta">
          <span className="avail-voting__timezone">{getTimezoneLabel(timezone)}</span>
          <span className="avail-voting__responses">{calendar.responseCount || 0} response{(calendar.responseCount || 0) !== 1 ? 's' : ''}</span>
          {isClosed && <span className="avail-voting__closed-badge">Closed</span>}
        </div>
      </div>

      <div className="avail-voting__user">
        {authState.discordUser?.avatar && (
          <img src={authState.discordUser.avatar} alt="" className="avail-voting__user-avatar" width={24} height={24} />
        )}
        <span>Filling in as <strong>{authState.discordUser?.username}</strong></span>
      </div>

      {isClosed && (
        <div className="avail-voting__closed-notice">
          This calendar is closed. You can view your previous response but cannot make changes.
        </div>
      )}

      <div className="avail-voting__grid-wrapper">
        <table className="avail-voting__grid">
          <thead>
            <tr>
              <th className="avail-voting__corner"></th>
              {dates.map(date => (
                <th key={date} className="avail-voting__day-header">
                  <span className="avail-voting__day-name">{getDayLabel(date)}</span>
                  <span className="avail-voting__day-date">{getDateLabel(date)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot: any) => (
              <tr key={slot.startTime}>
                <td className="avail-voting__slot-label">{slot.label}</td>
                {dates.map(date => {
                  const isAbsent = userAbsenceDates.has(date)
                  const cellStatus = isAbsent ? null : (selections[date]?.[slot.startTime] || null)
                  return (
                    <td
                      key={`${date}-${slot.startTime}`}
                      className={`avail-voting__cell ${getCellClass(cellStatus)} ${isClosed || isAbsent ? 'avail-voting__cell--disabled' : ''} ${isAbsent ? 'avail-voting__cell--absent' : ''}`}
                      onClick={() => cycleCell(date, slot.startTime)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleCell(date, slot.startTime) }
                      }}
                      aria-label={`${getDayLabel(date)} ${slot.label}: ${isAbsent ? 'absent' : cellStatus || 'unavailable'}`}
                    >
                      {isAbsent ? <XCircle size={14} /> : getCellIcon(cellStatus)}
                    </td>
                  )
                })}
              </tr>
            ))}
            {!isClosed && (
              <tr className="avail-voting__fill-row">
                <td className="avail-voting__slot-label avail-voting__slot-label--fill">Fill All</td>
                {dates.map(date => {
                  const isAbsent = userAbsenceDates.has(date)
                  if (isAbsent) return <td key={`fill-${date}`} className="avail-voting__fill-cell avail-voting__fill-cell--disabled"></td>
                  const fillState = getFillAllState(date)
                  const fillClass = fillState === 'available' ? 'avail-voting__fill-cell--available' : fillState === 'maybe' ? 'avail-voting__fill-cell--maybe' : ''
                  return (
                    <td
                      key={`fill-${date}`}
                      className={`avail-voting__fill-cell ${fillClass}`}
                      onClick={() => toggleFillAll(date)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFillAll(date) } }}
                      aria-label={`Fill all slots for ${getDayLabel(date)}`}
                    >
                      {fillState === 'available' ? <Check size={14} strokeWidth={3} /> : fillState === 'maybe' ? <HelpCircle size={12} /> : <Check size={14} />}
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="avail-voting__legend">
        <span className="avail-voting__legend-item">
          <span className="avail-voting__legend-swatch avail-voting__cell--available"><Check size={10} strokeWidth={3} /></span>
          Available
        </span>
        <span className="avail-voting__legend-item">
          <span className="avail-voting__legend-swatch avail-voting__cell--maybe"><HelpCircle size={10} /></span>
          Maybe
        </span>
        <span className="avail-voting__legend-item">
          <span className="avail-voting__legend-swatch avail-voting__cell--empty"></span>
          Not Available
        </span>
      </div>

      {!isClosed && (
        <div className="avail-voting__notes-section">
          <label className="avail-voting__notes-label">
            <Minus size={14} />
            Notes for your manager (optional)
          </label>
          <textarea
            className="avail-voting__notes-input"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            placeholder='e.g., "I put maybe for Saturday 8-10, waiting to hear back from work. Will update by Thursday."'
            rows={3}
            maxLength={500}
          />
        </div>
      )}

      {!isClosed && (
        <div className="avail-voting__actions">
          {error && <span className="avail-voting__error">{error}</span>}
          <button
            className="avail-voting__not-available-btn"
            onClick={handleNotAvailable}
            disabled={saving}
          >
            <XCircle size={16} />
            Not Available This Week
          </button>
          <button
            className={`avail-voting__save-btn ${saved ? 'avail-voting__save-btn--saved' : ''}`}
            onClick={() => handleSave()}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 size={16} className="avail-voting__spinner" /> Saving...</>
            ) : saved ? (
              <><CheckCircle size={16} /> Saved!</>
            ) : (
              <><Save size={16} /> Save Availability</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
