'use client'

import React, { useState, useCallback } from 'react'
import { Calendar, Check, Minus, HelpCircle, Save, CheckCircle, Loader2 } from 'lucide-react'
import './AvailabilityGrid.css'

interface TimeSlot {
  label: string
  startTime: string
  endTime: string
}

type CellStatus = 'available' | 'maybe' | null // null = unavailable (default)

interface DiscordUser {
  id: string
  username: string
  global_name?: string
  avatar?: string | null
}

interface ExistingResponse {
  selections: Record<string, Record<string, 'available' | 'maybe'>>
  notes?: string
}

interface AvailabilityGridProps {
  calendarId: number
  title: string
  teamName: string
  status: string
  dateRange: { start: string; end: string }
  timeSlots: TimeSlot[]
  timezone: string
  discordUser: DiscordUser
  existingResponse: ExistingResponse | null
  responseCount: number
}

export function AvailabilityGrid({
  calendarId,
  title,
  teamName,
  status,
  dateRange,
  timeSlots,
  timezone,
  discordUser,
  existingResponse,
  responseCount,
}: AvailabilityGridProps) {
  // Build dates array from dateRange
  const dates = React.useMemo(() => {
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

  // Initialize selections from existing response
  const [selections, setSelections] = useState<Record<string, Record<string, CellStatus>>>(() => {
    if (existingResponse?.selections) {
      const init: Record<string, Record<string, CellStatus>> = {}
      dates.forEach(date => {
        init[date] = {}
        timeSlots.forEach(slot => {
          const existing = existingResponse.selections[date]?.[slot.startTime]
          init[date][slot.startTime] = existing || null
        })
      })
      return init
    }
    // Default: all null (unavailable)
    const init: Record<string, Record<string, CellStatus>> = {}
    dates.forEach(date => {
      init[date] = {}
      timeSlots.forEach(slot => {
        init[date][slot.startTime] = null
      })
    })
    return init
  })

  const [notes, setNotes] = useState(existingResponse?.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isClosed = status === 'closed'

  // Three-state cycle: null → available → maybe → null
  const cycleCell = useCallback((date: string, slotStartTime: string) => {
    if (isClosed) return
    setSelections(prev => {
      const current = prev[date]?.[slotStartTime]
      let next: CellStatus
      if (current === null || current === undefined) next = 'available'
      else if (current === 'available') next = 'maybe'
      else next = null

      return {
        ...prev,
        [date]: {
          ...prev[date],
          [slotStartTime]: next,
        },
      }
    })
    setSaved(false)
  }, [isClosed])

  // Fill All three-state cycle: empty → available → maybe → empty
  const toggleFillAll = useCallback((date: string) => {
    if (isClosed) return
    setSelections(prev => {
      const daySlots = prev[date] || {}
      const allAvailable = timeSlots.every(slot => daySlots[slot.startTime] === 'available')
      const allMaybe = timeSlots.every(slot => daySlots[slot.startTime] === 'maybe')

      let nextStatus: CellStatus
      if (allAvailable) nextStatus = 'maybe'
      else if (allMaybe) nextStatus = null
      else nextStatus = 'available'

      const newDay: Record<string, CellStatus> = {}
      timeSlots.forEach(slot => {
        newDay[slot.startTime] = nextStatus
      })
      return { ...prev, [date]: newDay }
    })
    setSaved(false)
  }, [isClosed, timeSlots])

  // Get fill-all state for a day
  const getFillAllState = useCallback((date: string): CellStatus => {
    const daySlots = selections[date] || {}
    const allAvailable = timeSlots.every(slot => daySlots[slot.startTime] === 'available')
    if (allAvailable) return 'available'
    const allMaybe = timeSlots.every(slot => daySlots[slot.startTime] === 'maybe')
    if (allMaybe) return 'maybe'
    return null
  }, [selections, timeSlots])

  // Save handler
  const handleSave = async () => {
    setSaving(true)
    setError(null)

    // Transform selections: only include non-null entries
    const cleanSelections: Record<string, Record<string, 'available' | 'maybe'>> = {}
    Object.entries(selections).forEach(([date, slots]) => {
      Object.entries(slots).forEach(([slotTime, status]) => {
        if (status) {
          if (!cleanSelections[date]) cleanSelections[date] = {}
          cleanSelections[date][slotTime] = status
        }
      })
    })

    try {
      const res = await fetch(`/api/availability/${calendarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: cleanSelections,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  // Helpers
  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Friendly timezone label
  const getTimezoneLabel = (tz: string) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short',
      })
      const parts = formatter.formatToParts(new Date())
      const tzPart = parts.find(p => p.type === 'timeZoneName')
      return tzPart?.value || tz
    } catch {
      return tz
    }
  }

  const getCellClass = (status: CellStatus) => {
    if (status === 'available') return 'avail-grid__cell--available'
    if (status === 'maybe') return 'avail-grid__cell--maybe'
    return 'avail-grid__cell--empty'
  }

  const getCellIcon = (status: CellStatus) => {
    if (status === 'available') return <Check size={18} strokeWidth={3} />
    if (status === 'maybe') return <HelpCircle size={16} />
    return null
  }

  if (dates.length === 0 || timeSlots.length === 0) {
    return (
      <div className="avail-grid avail-grid--error">
        <h1>Invalid Calendar</h1>
        <p>This calendar is missing date or time slot configuration.</p>
      </div>
    )
  }

  return (
    <div className="avail-grid">
      {/* Header */}
      <div className="avail-grid__header">
        <div className="avail-grid__header-top">
          <Calendar size={24} />
          <div>
            <h1 className="avail-grid__title">{teamName}</h1>
            <p className="avail-grid__subtitle">{title}</p>
          </div>
        </div>
        <div className="avail-grid__meta">
          <span className="avail-grid__timezone">{getTimezoneLabel(timezone)}</span>
          <span className="avail-grid__responses">{responseCount} response{responseCount !== 1 ? 's' : ''}</span>
          {isClosed && <span className="avail-grid__closed-badge">Closed</span>}
        </div>
      </div>

      {/* User identity */}
      <div className="avail-grid__user">
        {discordUser.avatar && (
          <img
            src={discordUser.avatar}
            alt=""
            className="avail-grid__user-avatar"
            width={24}
            height={24}
          />
        )}
        <span>Filling in as <strong>{discordUser.global_name || discordUser.username}</strong></span>
      </div>

      {isClosed && (
        <div className="avail-grid__closed-notice">
          This calendar is closed. You can view your previous response but cannot make changes.
        </div>
      )}

      {/* Grid */}
      <div className="avail-grid__grid-wrapper">
        <table className="avail-grid__grid">
          <thead>
            <tr>
              <th className="avail-grid__corner"></th>
              {dates.map(date => (
                <th key={date} className="avail-grid__day-header">
                  <span className="avail-grid__day-name">{getDayLabel(date)}</span>
                  <span className="avail-grid__day-date">{getDateLabel(date)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => (
              <tr key={slot.startTime}>
                <td className="avail-grid__slot-label">{slot.label}</td>
                {dates.map(date => {
                  const cellStatus = selections[date]?.[slot.startTime] || null
                  return (
                    <td
                      key={`${date}-${slot.startTime}`}
                      className={`avail-grid__cell ${getCellClass(cellStatus)} ${isClosed ? 'avail-grid__cell--disabled' : ''}`}
                      onClick={() => cycleCell(date, slot.startTime)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          cycleCell(date, slot.startTime)
                        }
                      }}
                      aria-label={`${getDayLabel(date)} ${slot.label}: ${cellStatus || 'unavailable'}`}
                    >
                      {getCellIcon(cellStatus)}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Fill All row */}
            {!isClosed && (
              <tr className="avail-grid__fill-row">
                <td className="avail-grid__slot-label avail-grid__slot-label--fill">Fill All</td>
                {dates.map(date => {
                  const fillState = getFillAllState(date)
                  const fillClass = fillState === 'available'
                    ? 'avail-grid__fill-cell--available'
                    : fillState === 'maybe'
                      ? 'avail-grid__fill-cell--maybe'
                      : ''
                  return (
                    <td
                      key={`fill-${date}`}
                      className={`avail-grid__fill-cell ${fillClass}`}
                      onClick={() => toggleFillAll(date)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleFillAll(date)
                        }
                      }}
                      aria-label={`Fill all slots for ${getDayLabel(date)}`}
                    >
                      {fillState === 'available' ? <Check size={14} strokeWidth={3} /> :
                       fillState === 'maybe' ? <HelpCircle size={12} /> :
                       <Check size={14} />}
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="avail-grid__legend">
        <span className="avail-grid__legend-item">
          <span className="avail-grid__legend-swatch avail-grid__cell--available"><Check size={10} strokeWidth={3} /></span>
          Available
        </span>
        <span className="avail-grid__legend-item">
          <span className="avail-grid__legend-swatch avail-grid__cell--maybe"><HelpCircle size={10} /></span>
          Maybe
        </span>
        <span className="avail-grid__legend-item">
          <span className="avail-grid__legend-swatch avail-grid__cell--empty"></span>
          Not Available
        </span>
      </div>

      {/* Notes */}
      {!isClosed && (
        <div className="avail-grid__notes-section">
          <label className="avail-grid__notes-label">
            <Minus size={14} />
            Notes for your manager (optional)
          </label>
          <textarea
            className="avail-grid__notes-input"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            placeholder='e.g., "I put maybe for Saturday 8-10, waiting to hear back from work. Will update by Thursday."'
            rows={3}
            maxLength={500}
          />
        </div>
      )}

      {/* Save button */}
      {!isClosed && (
        <div className="avail-grid__actions">
          {error && <span className="avail-grid__error">{error}</span>}
          <button
            className={`avail-grid__save-btn ${saved ? 'avail-grid__save-btn--saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 size={16} className="avail-grid__spinner" /> Saving...</>
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
