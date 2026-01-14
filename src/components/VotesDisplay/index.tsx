'use client'

import React from 'react'
import { useField, useFormFields } from '@payloadcms/ui'

import './index.scss'

// Role order for display
const roleOrder = ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support']

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

export const VotesDisplay: React.FC<{ path: string }> = ({ path }) => {
  const { value } = useField<VoteData[] | null>({ path })
  
  // Get timeSlot from form
  const timeSlotField = useFormFields(([fields]) => fields['timeSlot'])
  const timeSlot = (timeSlotField?.value as string) || '8-10 EST'

  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="votes-display votes-display--empty">
        <div className="votes-display__empty-message">
          <span className="votes-display__empty-icon">📊</span>
          <p>No votes synced yet.</p>
          <p className="votes-display__empty-hint">
            Click <strong>"View Results"</strong> on the poll in Discord to sync votes.
          </p>
        </div>
      </div>
    )
  }

  // Filter to only days with votes
  const daysWithVotes = value.filter((day) => day.voterCount > 0)

  if (daysWithVotes.length === 0) {
    return (
      <div className="votes-display votes-display--empty">
        <div className="votes-display__empty-message">
          <span className="votes-display__empty-icon">🗳️</span>
          <p>No votes cast yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="votes-display">
      <div className="votes-display__header">
        <span className="votes-display__header-icon">📊</span>
        <span className="votes-display__header-title">Availability Overview</span>
        <span className="votes-display__header-count">
          {daysWithVotes.length} day{daysWithVotes.length !== 1 ? 's' : ''} with availability
        </span>
      </div>
      
      <div className="votes-display__days">
        {daysWithVotes.map((day, index) => (
          <DayCard key={index} day={day} timeSlot={timeSlot} />
        ))}
      </div>
    </div>
  )
}

const DayCard: React.FC<{ day: VoteData; timeSlot: string }> = ({ day, timeSlot }) => {
  // Group voters by role (if role data exists)
  const roleBreakdown = day.roleBreakdown || {}
  const hasRoles = Object.keys(roleBreakdown).length > 0

  // For now, we show all voters under "Available" since we don't have per-voter role data
  // The roleBreakdown only has counts, not who is in each role
  // TODO: When we have per-voter role data, group them properly
  
  return (
    <div className="votes-display__day-card">
      <div className="votes-display__day-header">
        <span className="votes-display__day-title">{day.date}</span>
        <span className="votes-display__day-time">| {timeSlot}</span>
      </div>
      
      <div className="votes-display__day-content">
        {hasRoles ? (
          // Show role breakdown
          <>
            {roleOrder.map((role) => {
              const count = roleBreakdown[role] || 0
              return (
                <div key={role} className="votes-display__role-row">
                  <span className="votes-display__role-label">{role}:</span>
                  <span className="votes-display__role-count">
                    {count > 0 ? `${count} available` : '—'}
                  </span>
                </div>
              )
            })}
            <div className="votes-display__role-row votes-display__role-row--available">
              <span className="votes-display__role-label">Available:</span>
              <span className="votes-display__role-voters">
                {day.voters.map((v) => v.displayName || v.username).join(', ') || '—'}
              </span>
            </div>
          </>
        ) : (
          // No role data - just show who's available
          <div className="votes-display__available">
            <span className="votes-display__available-label">Available:</span>
            <span className="votes-display__available-voters">
              {day.voters.map((v) => v.displayName || v.username).join(', ') || '—'}
            </span>
          </div>
        )}
      </div>
      
      <div className="votes-display__day-footer">
        <span className="votes-display__voter-count">
          {day.voterCount} player{day.voterCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

export default VotesDisplay
