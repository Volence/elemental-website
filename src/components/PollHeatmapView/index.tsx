'use client'

import React, { useMemo } from 'react'
import { useFormFields, useDocumentInfo } from '@payloadcms/ui'
import { BarChart3 } from 'lucide-react'

import '../AvailabilityHeatmapView/index.scss'

interface VoteData {
  date: string
  voterCount: number
  voters: Array<{
    id: string
    username: string
    displayName: string
  }>
  roleBreakdown?: Record<string, number> | null
}

/**
 * PollHeatmapView — displays Discord poll vote heatmap on the Schedules collection.
 * Reads the `votes` field directly from the form.
 * Uses the same SCSS as AvailabilityHeatmapView for visual consistency.
 */
export const PollHeatmapView: React.FC<{ path: string }> = () => {
  const { id } = useDocumentInfo()
  const votesField = useFormFields(([fields]) => fields['votes'])
  const statusField = useFormFields(([fields]) => fields['status'])

  const votes = votesField?.value as VoteData[] | null
  const status = (statusField?.value as string) || 'active'

  const maxVoters = useMemo(() => {
    if (!votes || votes.length === 0) return 1
    return Math.max(...votes.map(v => v.voterCount), 1)
  }, [votes])

  if (!id) {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>Save the schedule first to see the heatmap.</p>
        </div>
      </div>
    )
  }

  if (!votes || votes.length === 0) {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>No poll votes yet.</p>
          <p className="availability-heatmap__empty-hint">
            Create a Discord poll with /schedulepoll and votes will appear here.
          </p>
        </div>
      </div>
    )
  }

  // Total unique voters
  const allVoterIds = new Set<string>()
  votes.forEach(v => v.voters.forEach(voter => allVoterIds.add(voter.id)))
  const totalVoters = allVoterIds.size

  const getIntensityClass = (count: number) => {
    const ratio = count / maxVoters
    if (ratio === 0) return 'availability-heatmap__cell--empty'
    if (ratio < 0.33) return 'availability-heatmap__cell--low'
    if (ratio < 0.66) return 'availability-heatmap__cell--medium'
    return 'availability-heatmap__cell--high'
  }

  // Parse day labels from vote dates (e.g., "Monday March 23rd")
  const getDayAbbrev = (dateLabel: string) => {
    const parts = dateLabel.split(' ')
    return parts[0]?.substring(0, 3) || ''
  }

  const getDateAbbrev = (dateLabel: string) => {
    const parts = dateLabel.split(' ')
    return parts.length >= 3 ? `${parts[1]} ${parts[2]}` : dateLabel
  }

  return (
    <div className="availability-heatmap">
      <div className="availability-heatmap__header">
        <div className="availability-heatmap__header-left">
          <BarChart3 size={16} />
          <span>{totalVoters} voter{totalVoters !== 1 ? 's' : ''}</span>
        </div>
        <div className="availability-heatmap__status">
          {status === 'active' ? '🟢 Active' : status === 'closed' ? '🔴 Closed' : '📋 Scheduled'}
        </div>
      </div>

      {/* Grid — single row since polls are date-level only */}
      <div className="availability-heatmap__grid-wrapper">
        <table className="availability-heatmap__grid">
          <thead>
            <tr>
              <th className="availability-heatmap__corner"></th>
              {votes.map((v, i) => (
                <th key={i} className="availability-heatmap__day-header">
                  <span className="availability-heatmap__day-name">{getDayAbbrev(v.date)}</span>
                  <span className="availability-heatmap__day-date">{getDateAbbrev(v.date)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="availability-heatmap__slot-label">Available</td>
              {votes.map((v, i) => (
                <td
                  key={i}
                  className={`availability-heatmap__cell ${getIntensityClass(v.voterCount)}`}
                  title={v.voters.map(voter => `✅ ${voter.displayName}`).join('\n') || 'No one available'}
                >
                  <span className="availability-heatmap__cell-count">{v.voterCount || ''}</span>
                </td>
              ))}
            </tr>
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
    </div>
  )
}

export default PollHeatmapView
