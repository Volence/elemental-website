'use client'

import React, { useMemo, useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { BarChart3, Users, AlertTriangle } from 'lucide-react'

import './index.scss'

interface TimeSlot {
  label: string
  startTime: string
  endTime: string
}

interface AvailabilityResponse {
  discordId: string
  discordUsername: string
  discordAvatar?: string
  respondedAt: string
  selections: Record<string, Record<string, 'available' | 'maybe'>>
  notes?: string
}

interface CalendarData {
  dateRange: { start: string; end: string }
  timeSlots: TimeSlot[]
  responses: AvailabilityResponse[]
  status: string
  responseCount: number
  availabilityChangedAfterSchedule: boolean
}

export const AvailabilityHeatmapView: React.FC<{ path: string }> = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)

  // Detect which collection we're in — works for both availability-calendars and discord-polls
  const apiSlug = collectionSlug || 'availability-calendars'

  // Fetch the full document data via API (hidden fields aren't in useFormFields)
  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/${apiSlug}/${id}?depth=0`)
        if (res.ok) {
          const doc = await res.json()
          setData({
            dateRange: doc.dateRange || {},
            timeSlots: doc.timeSlots || [],
            responses: doc.responses || [],
            status: doc.status || 'open',
            responseCount: doc.responseCount || 0,
            availabilityChangedAfterSchedule: doc.availabilityChangedAfterSchedule || false,
          })
        }
      } catch (err) {
        console.error('[Heatmap] Failed to fetch calendar data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, apiSlug])

  const dates = useMemo(() => {
    if (!data?.dateRange?.start || !data?.dateRange?.end) return []
    const startDate = new Date(data.dateRange.start)
    const endDate = new Date(data.dateRange.end)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return []

    const days: string[] = []
    const current = new Date(startDate)
    while (current <= endDate) {
      days.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return days
  }, [data?.dateRange])

  const timeSlots = data?.timeSlots || []
  const responses = data?.responses || []

  if (loading) {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>Loading heatmap...</p>
        </div>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>Save the calendar first to see the heatmap.</p>
        </div>
      </div>
    )
  }

  if (responses.length === 0 && dates.length > 0) {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>No availability data yet.</p>
          <p className="availability-heatmap__empty-hint">
            Share the calendar link with your team to start collecting responses.
          </p>
        </div>
      </div>
    )
  }

  if (dates.length === 0 || timeSlots.length === 0) {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>Calendar needs a date range and time slots configured.</p>
        </div>
      </div>
    )
  }

  // Build the heatmap data
  const heatmapData: Record<string, Record<string, { available: string[]; maybe: string[] }>> = {}

  dates.forEach(date => {
    heatmapData[date] = {}
    timeSlots.forEach(slot => {
      heatmapData[date][slot.startTime] = { available: [], maybe: [] }
    })
  })

  responses.forEach(response => {
    dates.forEach(date => {
      timeSlots.forEach(slot => {
        const status = response.selections?.[date]?.[slot.startTime]
        if (status === 'available') {
          heatmapData[date][slot.startTime].available.push(response.discordUsername)
        } else if (status === 'maybe') {
          heatmapData[date][slot.startTime].maybe.push(response.discordUsername)
        }
      })
    })
  })

  // Player notes
  const playerNotes = responses.filter(r => r.notes && r.notes.trim())
  const maxPlayers = responses.length || 1

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getIntensityClass = (count: number) => {
    const ratio = count / maxPlayers
    if (ratio === 0) return 'availability-heatmap__cell--empty'
    if (ratio < 0.33) return 'availability-heatmap__cell--low'
    if (ratio < 0.66) return 'availability-heatmap__cell--medium'
    return 'availability-heatmap__cell--high'
  }

  return (
    <div className="availability-heatmap">
      {data?.availabilityChangedAfterSchedule && (
        <div className="availability-heatmap__changed-flag">
          <AlertTriangle size={14} />
          <span>Availability was updated after the schedule was built — review changes</span>
        </div>
      )}

      <div className="availability-heatmap__header">
        <div className="availability-heatmap__header-left">
          <BarChart3 size={16} />
          <span>{responses.length} response{responses.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="availability-heatmap__status">
          {data?.status === 'open' || data?.status === 'active'
            ? '🟢 Open'
            : data?.status === 'scheduled'
              ? '📋 Scheduled'
              : '🔴 Closed'}
        </div>
      </div>

      {/* Grid */}
      <div className="availability-heatmap__grid-wrapper">
        <table className="availability-heatmap__grid">
          <thead>
            <tr>
              <th className="availability-heatmap__corner"></th>
              {dates.map(date => (
                <th key={date} className="availability-heatmap__day-header">
                  <span className="availability-heatmap__day-name">{getDayLabel(date)}</span>
                  <span className="availability-heatmap__day-date">{getDateLabel(date)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => (
              <tr key={slot.startTime}>
                <td className="availability-heatmap__slot-label">{slot.label}</td>
                {dates.map(date => {
                  const cell = heatmapData[date]?.[slot.startTime] || { available: [], maybe: [] }
                  const total = cell.available.length + cell.maybe.length
                  const maybeClass = cell.maybe.length > 0 && cell.available.length > 0
                    ? 'availability-heatmap__cell--has-maybe'
                    : cell.maybe.length > 0 && cell.available.length === 0
                      ? 'availability-heatmap__cell--all-maybe'
                      : ''
                  return (
                    <td
                      key={`${date}-${slot.startTime}`}
                      className={`availability-heatmap__cell ${getIntensityClass(total)} ${maybeClass}`}
                      title={[
                        ...cell.available.map(n => `✅ ${n}`),
                        ...cell.maybe.map(n => `🟡 ${n}`),
                      ].join('\n') || 'No one available'}
                    >
                      <span className="availability-heatmap__cell-count">{total || ''}</span>
                      {cell.maybe.length > 0 && total > 0 && (
                        <span className="availability-heatmap__cell-maybe">
                          {cell.maybe.length}?
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="availability-heatmap__legend">
        <span className="availability-heatmap__legend-item">
          <span className="availability-heatmap__legend-swatch availability-heatmap__cell--empty"></span>
          0
        </span>
        <span className="availability-heatmap__legend-item">
          <span className="availability-heatmap__legend-swatch availability-heatmap__cell--low"></span>
          Few
        </span>
        <span className="availability-heatmap__legend-item">
          <span className="availability-heatmap__legend-swatch availability-heatmap__cell--medium"></span>
          Some
        </span>
        <span className="availability-heatmap__legend-item">
          <span className="availability-heatmap__legend-swatch availability-heatmap__cell--high"></span>
          Most
        </span>
      </div>

      {/* Player notes */}
      {playerNotes.length > 0 && (
        <div className="availability-heatmap__notes">
          <h4><Users size={14} /> Player Notes</h4>
          {playerNotes.map((response, i) => (
            <div key={i} className="availability-heatmap__note">
              <strong>{response.discordUsername}:</strong> {response.notes}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AvailabilityHeatmapView
