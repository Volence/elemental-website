'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useField, useFormFields, useDocumentInfo, useFormModified, toast } from '@payloadcms/ui'
import { publishScheduleAction } from '@/actions/publish-schedule'
import { postScrimReminderAction } from '@/actions/post-scrim-reminder'

import './index.scss'

// Role presets matching Teams collection
const rolePresets: Record<string, string[]> = {
  'ow2-specific': ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
  'generic': ['Tank', 'DPS', 'Support'],
  'custom': [], // Will use customRoles from team
}

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

interface PlayerSlot {
  role: string
  playerId: string | null
}

interface DaySchedule {
  date: string
  slots: PlayerSlot[]
  extraPlayers: string[] // Additional player IDs beyond role slots
  scrim?: {
    opponent: string
    opponentRoster: string
    contact: string
    time: string
    host: 'us' | 'them' | ''
    mapPool: string
    heroBans: boolean
    staggers: boolean
    notes: string
  }
  enabled: boolean
  reminderPosted?: boolean // Track if reminder was posted for this day
}

interface ScheduleData {
  days: DaySchedule[]
  lastUpdated?: string
}

// Get all unique players from vote data
const getAvailablePlayers = (votes: VoteData[] | null, targetDate: string) => {
  if (!votes) return []
  const day = votes.find((v) => v.date === targetDate)
  if (!day) return []
  return day.voters
}

export const ScheduleEditor: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<ScheduleData | null>({ path })
  
  // Get votes, timeSlot, and team from form
  const votesField = useFormFields(([fields]) => fields['votes'])
  const timeSlotField = useFormFields(([fields]) => fields['timeSlot'])
  const teamField = useFormFields(([fields]) => fields['team'])
  
  const votes = votesField?.value as VoteData[] | null
  const timeSlot = (timeSlotField?.value as string) || '8-10 EST'
  const team = teamField?.value as any

  // Determine roles based on team preset
  const [roles, setRoles] = useState<string[]>(rolePresets['ow2-specific'])

  // Update roles when team data is available
  useEffect(() => {
    if (team && typeof team === 'object') {
      const preset = team.discordThreads?.rolePreset || 'ow2-specific'
      if (preset === 'custom' && team.discordThreads?.customRoles) {
        setRoles(team.discordThreads.customRoles)
      } else if (rolePresets[preset]) {
        setRoles(rolePresets[preset])
      }
    }
  }, [team])

  // Initialize schedule from votes if empty
  const createInitialSchedule = useCallback((): ScheduleData => {
    if (value && value.days && value.days.length > 0) {
      return value
    }
    if (votes && votes.length > 0) {
      return {
        days: votes.map((v) => ({
          date: v.date,
          slots: roles.map((role) => ({ role, playerId: null })),
          extraPlayers: [],
          scrim: {
            opponent: '',
            opponentRoster: '',
            contact: '',
            time: timeSlot, // Default to poll's time slot
            host: '' as const,
            mapPool: '',
            heroBans: true,
            staggers: false,
            notes: '',
          },
          enabled: v.voterCount > 0,
        })),
        lastUpdated: new Date().toISOString(),
      }
    }
    return { days: [], lastUpdated: new Date().toISOString() }
  }, [value, votes, roles, timeSlot])

  const [schedule, setSchedule] = useState<ScheduleData>(createInitialSchedule)

  // Sync schedule changes to field
  const updateSchedule = useCallback(
    (newSchedule: ScheduleData) => {
      const updated = { ...newSchedule, lastUpdated: new Date().toISOString() }
      setSchedule(updated)
      setValue(updated)
    },
    [setValue],
  )

  // Update a specific slot's player assignment
  const assignSlot = (dayIndex: number, slotIndex: number, playerId: string | null) => {
    const newDays = [...schedule.days]
    const newSlots = [...newDays[dayIndex].slots]
    newSlots[slotIndex] = { ...newSlots[slotIndex], playerId }
    newDays[dayIndex] = { ...newDays[dayIndex], slots: newSlots }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update a slot's role label
  const updateSlotRole = (dayIndex: number, slotIndex: number, newRole: string) => {
    const newDays = [...schedule.days]
    const newSlots = [...newDays[dayIndex].slots]
    newSlots[slotIndex] = { ...newSlots[slotIndex], role: newRole }
    newDays[dayIndex] = { ...newDays[dayIndex], slots: newSlots }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Add extra player slot
  const addExtraPlayer = (dayIndex: number) => {
    const newDays = [...schedule.days]
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      slots: [...newDays[dayIndex].slots, { role: 'Extra', playerId: null }],
    }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Remove a slot
  const removeSlot = (dayIndex: number, slotIndex: number) => {
    const newDays = [...schedule.days]
    const newSlots = newDays[dayIndex].slots.filter((_, i) => i !== slotIndex)
    newDays[dayIndex] = { ...newDays[dayIndex], slots: newSlots }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update scrim details for a day
  const updateScrim = (
    dayIndex: number,
    field: keyof NonNullable<DaySchedule['scrim']>,
    fieldValue: string | boolean,
  ) => {
    const newDays = [...schedule.days]
    const currentScrim = newDays[dayIndex].scrim
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      scrim: {
        opponent: currentScrim?.opponent || '',
        opponentRoster: currentScrim?.opponentRoster || '',
        contact: currentScrim?.contact || '',
        time: currentScrim?.time || timeSlot,
        host: currentScrim?.host || '',
        mapPool: currentScrim?.mapPool || '',
        heroBans: currentScrim?.heroBans ?? true,
        staggers: currentScrim?.staggers ?? false,
        notes: currentScrim?.notes || '',
        [field]: fieldValue,
      },
    }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Toggle day enabled/disabled
  const toggleDay = (dayIndex: number) => {
    const newDays = [...schedule.days]
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      enabled: !newDays[dayIndex].enabled,
    }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Mark a day as having reminder posted
  const markReminderPosted = (dayIndex: number) => {
    const newDays = [...schedule.days]
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      reminderPosted: true,
    }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Get assigned player IDs for a day (to filter dropdowns)
  const getAssignedPlayerIds = (dayIndex: number): Set<string> => {
    const day = schedule.days[dayIndex]
    if (!day) return new Set()
    return new Set(day.slots.map((s) => s.playerId).filter(Boolean) as string[])
  }

  // Re-initialize if votes change (but preserve existing assignments)
  useEffect(() => {
    if (votes && votes.length > 0 && schedule.days.length === 0) {
      updateSchedule(createInitialSchedule())
    }
  }, [votes, schedule.days.length, updateSchedule, createInitialSchedule])

  if (!votes || votes.length === 0) {
    return (
      <div className="schedule-editor schedule-editor--empty">
        <div className="schedule-editor__empty-message">
          <span className="schedule-editor__empty-icon">📅</span>
          <p>No vote data available yet.</p>
          <p className="schedule-editor__empty-hint">
            Sync votes first by clicking <strong>"View Results"</strong> on the poll in Discord.
          </p>
        </div>
      </div>
    )
  }

  if (schedule.days.length === 0) {
    return (
      <div className="schedule-editor schedule-editor--loading">
        <p>Initializing schedule...</p>
      </div>
    )
  }

  return (
    <div className="schedule-editor">
      <div className="schedule-editor__header">
        <span className="schedule-editor__header-icon">📅</span>
        <span className="schedule-editor__header-title">Schedule Builder</span>
        <span className="schedule-editor__header-hint">
          Assign players to roles for each scrim day
        </span>
      </div>

      <div className="schedule-editor__days">
        {schedule.days.map((day, dayIndex) => {
          const availablePlayers = getAvailablePlayers(votes, day.date)
          const assignedIds = getAssignedPlayerIds(dayIndex)
          const voteData = votes.find((v) => v.date === day.date)

          return (
            <div
              key={day.date}
              className={`schedule-editor__day-card ${!day.enabled ? 'schedule-editor__day-card--disabled' : ''}`}
            >
              <div className="schedule-editor__day-header">
                <label className="schedule-editor__day-toggle">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => toggleDay(dayIndex)}
                  />
                  <span className="schedule-editor__day-title">{day.date}</span>
                </label>
                <span className="schedule-editor__day-time">| {timeSlot}</span>
                {voteData && (
                  <span className="schedule-editor__day-voters">
                    {voteData.voterCount} available
                  </span>
                )}
              </div>

              {day.enabled && (
                <div className="schedule-editor__day-content">
                  <div className="schedule-editor__roles">
                    {day.slots.map((slot, slotIndex) => {
                      // Filter out already-assigned players (except current selection)
                      const filteredPlayers = availablePlayers.filter(
                        (p) => !assignedIds.has(p.id) || p.id === slot.playerId,
                      )

                      return (
                        <div key={slotIndex} className="schedule-editor__role-row">
                          <input
                            type="text"
                            className="schedule-editor__role-input"
                            value={slot.role}
                            onChange={(e) => updateSlotRole(dayIndex, slotIndex, e.target.value)}
                            placeholder="Role..."
                          />
                          <select
                            className="schedule-editor__role-select"
                            value={slot.playerId || ''}
                            onChange={(e) =>
                              assignSlot(dayIndex, slotIndex, e.target.value || null)
                            }
                          >
                            <option value="">— Select —</option>
                            {filteredPlayers.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.displayName || player.username}
                              </option>
                            ))}
                          </select>
                          {slotIndex >= roles.length && (
                            <button
                              type="button"
                              className="schedule-editor__remove-btn"
                              onClick={() => removeSlot(dayIndex, slotIndex)}
                              title="Remove slot"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      className="schedule-editor__add-btn"
                      onClick={() => addExtraPlayer(dayIndex)}
                    >
                      + Add Player
                    </button>
                  </div>

                  <div className="schedule-editor__scrim">
                    <div className="schedule-editor__scrim-header">Scrim Details</div>
                    <div className="schedule-editor__scrim-fields">
                      <div className="schedule-editor__scrim-field">
                        <label>Opponent:</label>
                        <input
                          type="text"
                          placeholder="e.g., Team Name"
                          value={day.scrim?.opponent || ''}
                          onChange={(e) => updateScrim(dayIndex, 'opponent', e.target.value)}
                        />
                      </div>
                      <div className="schedule-editor__scrim-field">
                        <label>Contact:</label>
                        <input
                          type="text"
                          placeholder="e.g., Username#1234"
                          value={day.scrim?.contact || ''}
                          onChange={(e) => updateScrim(dayIndex, 'contact', e.target.value)}
                        />
                      </div>
                      <div className="schedule-editor__scrim-field">
                        <label>Time:</label>
                        <input
                          type="text"
                          placeholder="e.g., 9 PM EST"
                          value={day.scrim?.time || timeSlot}
                          onChange={(e) => updateScrim(dayIndex, 'time', e.target.value)}
                        />
                      </div>
                      <div className="schedule-editor__scrim-field">
                        <label>Host:</label>
                        <select
                          value={day.scrim?.host || ''}
                          onChange={(e) => updateScrim(dayIndex, 'host', e.target.value)}
                        >
                          <option value="">— Select —</option>
                          <option value="us">Us</option>
                          <option value="them">Them</option>
                        </select>
                      </div>
                      <div className="schedule-editor__scrim-field">
                        <label>Map Pool:</label>
                        <input
                          type="text"
                          placeholder="e.g., Faceit"
                          value={day.scrim?.mapPool || ''}
                          onChange={(e) => updateScrim(dayIndex, 'mapPool', e.target.value)}
                        />
                      </div>
                      <div className="schedule-editor__scrim-field">
                        <label>Hero Bans:</label>
                        <div className="schedule-editor__toggle">
                          <label className="schedule-editor__toggle-label">
                            <input
                              type="checkbox"
                              checked={day.scrim?.heroBans ?? true}
                              onChange={(e) => updateScrim(dayIndex, 'heroBans', e.target.checked)}
                            />
                            <span>{day.scrim?.heroBans ?? true ? 'On' : 'Off'}</span>
                          </label>
                        </div>
                      </div>
                      <div className="schedule-editor__scrim-field">
                        <label>Staggers:</label>
                        <div className="schedule-editor__toggle">
                          <label className="schedule-editor__toggle-label">
                            <input
                              type="checkbox"
                              checked={day.scrim?.staggers ?? false}
                              onChange={(e) => updateScrim(dayIndex, 'staggers', e.target.checked)}
                            />
                            <span>{day.scrim?.staggers ? 'On' : 'Off'}</span>
                          </label>
                        </div>
                      </div>
                      <div className="schedule-editor__scrim-field schedule-editor__scrim-field--full">
                        <label>Opponent Roster:</label>
                        <textarea
                          placeholder="Paste opponent roster here..."
                          rows={4}
                          value={day.scrim?.opponentRoster || ''}
                          onChange={(e) => updateScrim(dayIndex, 'opponentRoster', e.target.value)}
                        />
                      </div>
                      <div className="schedule-editor__scrim-field schedule-editor__scrim-field--full">
                        <label>Notes:</label>
                        <input
                          type="text"
                          placeholder="Any additional notes..."
                          value={day.scrim?.notes || ''}
                          onChange={(e) => updateScrim(dayIndex, 'notes', e.target.value)}
                        />
                      </div>
                      <ReminderButton 
                        dayDate={day.date} 
                        hasOpponent={Boolean(day.scrim?.opponent)}
                        reminderPosted={day.reminderPosted}
                        onReminderPosted={() => markReminderPosted(dayIndex)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="schedule-editor__footer">
        {schedule.lastUpdated && (
          <span className="schedule-editor__footer-updated" suppressHydrationWarning>
            ✓ Saved {new Date(schedule.lastUpdated).toLocaleString([], { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
        <PublishButton />
      </div>
    </div>
  )
}

// Reminder button component for per-day scrim posts
interface ReminderButtonProps {
  dayDate: string
  hasOpponent: boolean
  reminderPosted?: boolean
  onReminderPosted: () => void
}

const ReminderButton: React.FC<ReminderButtonProps> = ({ 
  dayDate, 
  hasOpponent, 
  reminderPosted,
  onReminderPosted 
}) => {
  const { id } = useDocumentInfo()
  const isModified = useFormModified()
  const [isPosting, setIsPosting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (!id) return null

  const handlePost = async () => {
    setShowModal(false)
    setIsPosting(true)
    try {
      const result = await postScrimReminderAction(Number(id), dayDate)
      if (result.success) {
        toast.success('Scrim reminder posted!')
        onReminderPosted()
      } else {
        toast.error(result.error || 'Failed to post reminder')
      }
    } catch (error) {
      toast.error('Error posting reminder')
    } finally {
      setIsPosting(false)
    }
  }

  // Disable if no opponent is set
  if (!hasOpponent) {
    return (
      <button
        type="button"
        className="schedule-editor__reminder-btn schedule-editor__reminder-btn--disabled"
        disabled
        title="Set an opponent first"
      >
        📣 Set opponent to post reminder
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`schedule-editor__reminder-btn ${reminderPosted ? 'schedule-editor__reminder-btn--posted' : ''}`}
        onClick={() => setShowModal(true)}
        disabled={isPosting}
      >
        {isPosting ? '📣 Posting...' : reminderPosted ? '✓ Reminder Posted' : '📣 Post Reminder'}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-editor__modal schedule-editor__modal--reminder" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon">📣</span>
              <h3>Post Scrim Reminder</h3>
            </div>
            <div className="schedule-editor__modal-body">
              {isModified && (
                <p className="schedule-editor__modal-warning">
                  ⚠️ You have unsaved changes. Save first to ensure the latest info is posted.
                </p>
              )}
              <p>Post a reminder for <strong>{dayDate}</strong> to the <strong>Schedule thread</strong>?</p>
              {reminderPosted && (
                <p className="schedule-editor__modal-hint">Note: A reminder was already posted for this day.</p>
              )}
            </div>
            <div className="schedule-editor__modal-actions">
              <button
                type="button"
                className="schedule-editor__modal-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="schedule-editor__modal-confirm schedule-editor__modal-confirm--reminder"
                onClick={handlePost}
              >
                {reminderPosted ? 'Post Again' : 'Post Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Publish button component with modal
const PublishButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const isModified = useFormModified()
  const [isPublishing, setIsPublishing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (!id) return null

  const handlePublish = async () => {
    setShowModal(false)
    setIsPublishing(true)
    try {
      const result = await publishScheduleAction(Number(id))
      if (result.success) {
        toast.success('Schedule published to Discord!')
      } else {
        toast.error(result.error || 'Failed to publish')
      }
    } catch (error) {
      toast.error('Error publishing schedule')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="schedule-editor__publish-btn"
        onClick={() => setShowModal(true)}
        disabled={isPublishing}
      >
        {isPublishing ? '📤 Publishing...' : '📤 Publish to Discord'}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-editor__modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon">📤</span>
              <h3>Publish Schedule</h3>
            </div>
            <div className="schedule-editor__modal-body">
              {isModified && (
                <p className="schedule-editor__modal-warning">
                  ⚠️ You have unsaved changes. Save first to ensure the latest info is posted.
                </p>
              )}
              <p>This will post the schedule to the team's <strong>Calendar thread</strong> on Discord.</p>
            </div>
            <div className="schedule-editor__modal-actions">
              <button
                type="button"
                className="schedule-editor__modal-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="schedule-editor__modal-confirm"
                onClick={handlePublish}
              >
                Publish to Discord
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ScheduleEditor
