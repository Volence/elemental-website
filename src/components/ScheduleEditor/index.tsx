'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useField, useFormFields, useDocumentInfo, useFormModified, toast } from '@payloadcms/ui'
import { publishScheduleAction } from '@/actions/publish-schedule'
import { postScrimReminderAction } from '@/actions/post-scrim-reminder'
import { ScrimAnalytics } from '@/components/ScrimAnalytics'

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
  isRinger?: boolean      // NEW: Is this a ringer (not on team roster)?
  ringerName?: string     // NEW: Text name if ringer not in DB
}

// NEW: Time block within a day (replaces single scrim)
interface TimeBlock {
  id: string              // Unique ID for React keys
  time: string            // e.g., "8-10 EST"
  slots: PlayerSlot[]
  scrim?: {
    opponentTeamId?: number | null
    opponent: string
    opponentRoster: string
    contact: string
    host: 'us' | 'them' | ''
    mapPool: string
    heroBans: boolean
    staggers: boolean
    notes: string
  }
  reminderPosted?: boolean
  // Scrim outcome fields
  outcome?: {
    ourRating?: 'easywin' | 'closewin' | 'neutral' | 'closeloss' | 'gotrolled'
    opponentRating?: 'weak' | 'average' | 'strong' | 'verystrong'
    worthScrimAgain?: 'yes' | 'maybe' | 'no'
    mapsPlayed?: Array<{
      mapName: string
      result: 'win' | 'loss' | 'draw'
      score?: string
    }>
    scrimNotes?: string
  }
}

// Legacy scrim format (for migration from old data)
interface LegacyScrim {
  opponentTeamId?: number | null
  opponent: string
  opponentRoster: string
  contact: string
  time?: string  // OLD: time was on scrim, now on block
  host: 'us' | 'them' | ''
  mapPool: string
  heroBans: boolean
  staggers: boolean
  notes: string
}

interface DaySchedule {
  date: string
  enabled: boolean
  useAllMembers?: boolean  // NEW: Use full team roster instead of just voters
  blocks: TimeBlock[]      // CHANGED: Multiple blocks per day
  // Keep legacy fields for backward compatibility during migration
  slots?: PlayerSlot[]
  extraPlayers?: string[]
  scrim?: LegacyScrim      // Use legacy interface for migration
  reminderPosted?: boolean
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
  
  // Opponent teams for dropdown
  const [opponentTeams, setOpponentTeams] = useState<Array<{id: number, name: string}>>([])
  
  // Team members for "use all team members" option
  const [teamMembers, setTeamMembers] = useState<Array<{id: string, username: string, displayName: string}>>([])
  
  // All people for ringer autocomplete
  const [allPeople, setAllPeople] = useState<Array<{id: number, name: string}>>([])
  
  // Maps for outcome autocomplete
  const [maps, setMaps] = useState<Array<{id: number, name: string}>>([])
  
  // Analytics modal state
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  // Fetch opponent teams and people on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch opponent teams
        const opponentRes = await fetch('/api/opponent-teams?limit=100&sort=name')
        if (opponentRes.ok) {
          const data = await opponentRes.json()
          setOpponentTeams(data.docs || [])
        }
        
        // Fetch all people for ringer autocomplete
        const peopleRes = await fetch('/api/people?limit=200&sort=name')
        if (peopleRes.ok) {
          const data = await peopleRes.json()
          setAllPeople(data.docs || [])
        }
        
        // Fetch maps for outcome autocomplete
        const mapsRes = await fetch('/api/maps?limit=100&sort=name')
        if (mapsRes.ok) {
          const data = await mapsRes.json()
          setMaps(data.docs || [])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }
    fetchData()
  }, [])

  // Fetch team members when team is available
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!team) return
      const teamId = typeof team === 'object' ? team.id : team
      if (!teamId) return
      
      try {
        // Fetch team with populated roster (depth=1 populates the person relationship)
        const res = await fetch(`/api/teams/${teamId}?depth=1`)
        if (res.ok) {
          const teamData = await res.json()
          // roster is array of { person: People, role: string }
          const roster = teamData.roster || []
          // Map roster entries to player format, extracting the person object
          const mappedMembers = roster
            .filter((entry: any) => entry.person && typeof entry.person === 'object')
            .map((entry: any) => ({
              id: String(entry.person.id),
              username: entry.person.name || 'Unknown',
              displayName: entry.person.name || 'Unknown',
            }))
          console.log('Team members loaded:', mappedMembers.length)
          setTeamMembers(mappedMembers)
        }
      } catch (error) {
        console.error('Failed to fetch team members:', error)
      }
    }
    fetchTeamMembers()
  }, [team])

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

  // Helper to generate unique block IDs
  const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Create a default block with empty slots
  const createDefaultBlock = useCallback((time: string): TimeBlock => ({
    id: generateBlockId(),
    time,
    slots: roles.map((role) => ({ role, playerId: null })),
    scrim: {
      opponentTeamId: null,
      opponent: '',
      opponentRoster: '',
      contact: '',
      host: '' as const,
      mapPool: '',
      heroBans: true,
      staggers: false,
      notes: '',
    },
    reminderPosted: false,
  }), [roles])
  
  // Migrate old format to new block format
  const migrateToBlocks = useCallback((day: DaySchedule): DaySchedule => {
    // Already has blocks - return as-is
    if (day.blocks && day.blocks.length > 0) {
      return day
    }
    // Migrate old format
    return {
      date: day.date,
      enabled: day.enabled,
      useAllMembers: false,
      blocks: [{
        id: generateBlockId(),
        time: day.scrim?.time || timeSlot || '8-10 EST',
        slots: day.slots || roles.map(role => ({ role, playerId: null })),
        scrim: day.scrim ? {
          opponentTeamId: day.scrim.opponentTeamId,
          opponent: day.scrim.opponent || '',
          opponentRoster: day.scrim.opponentRoster || '',
          contact: day.scrim.contact || '',
          host: day.scrim.host || '',
          mapPool: day.scrim.mapPool || '',
          heroBans: day.scrim.heroBans ?? true,
          staggers: day.scrim.staggers ?? false,
          notes: day.scrim.notes || '',
        } : undefined,
        reminderPosted: day.reminderPosted,
      }],
    }
  }, [roles, timeSlot])

  // Initialize schedule from votes if empty
  const createInitialSchedule = useCallback((): ScheduleData => {
    if (value && value.days && value.days.length > 0) {
      // Migrate existing data to block format
      return {
        ...value,
        days: value.days.map(migrateToBlocks),
      }
    }
    if (votes && votes.length > 0) {
      // Create from poll votes
      return {
        days: votes.map((v) => ({
          date: v.date,
          enabled: v.voterCount > 0,
          useAllMembers: false,
          blocks: [createDefaultBlock(timeSlot || '8-10 EST')],
        })),
        lastUpdated: new Date().toISOString(),
      }
    }
    // Empty schedule - will be populated by standalone creation UI
    return { days: [], lastUpdated: new Date().toISOString() }
  }, [value, votes, timeSlot, createDefaultBlock, migrateToBlocks])

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

  // Update a specific slot's player assignment in a block
  const assignSlot = (dayIndex: number, blockIndex: number, slotIndex: number, playerId: string | null) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    const newSlots = [...newBlocks[blockIndex].slots]
    newSlots[slotIndex] = { ...newSlots[slotIndex], playerId }
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update a slot's role label in a block
  const updateSlotRole = (dayIndex: number, blockIndex: number, slotIndex: number, newRole: string) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    const newSlots = [...newBlocks[blockIndex].slots]
    newSlots[slotIndex] = { ...newSlots[slotIndex], role: newRole }
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Add extra player slot to a block
  const addExtraPlayer = (dayIndex: number, blockIndex: number) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    newBlocks[blockIndex] = {
      ...newBlocks[blockIndex],
      slots: [...newBlocks[blockIndex].slots, { role: 'Extra', playerId: null }],
    }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Remove a slot from a block
  const removeSlot = (dayIndex: number, blockIndex: number, slotIndex: number) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    const newSlots = newBlocks[blockIndex].slots.filter((_, i) => i !== slotIndex)
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Toggle a slot's ringer status
  const toggleSlotRinger = (dayIndex: number, blockIndex: number, slotIndex: number) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    const newSlots = [...newBlocks[blockIndex].slots]
    const isRinger = !newSlots[slotIndex].isRinger
    newSlots[slotIndex] = { 
      ...newSlots[slotIndex], 
      isRinger,
      playerId: isRinger ? null : newSlots[slotIndex].playerId, // Clear player when switching to ringer
      ringerName: isRinger ? '' : undefined, // Reset ringer name
    }
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update a ringer's name (from autocomplete or manual input)
  const updateRingerName = (dayIndex: number, blockIndex: number, slotIndex: number, name: string, personId?: number) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    const newSlots = [...newBlocks[blockIndex].slots]
    newSlots[slotIndex] = { 
      ...newSlots[slotIndex], 
      ringerName: name,
      playerId: personId ? String(personId) : null, // Link to People if selected from autocomplete
    }
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update scrim details for a block
  const updateBlockScrim = (
    dayIndex: number,
    blockIndex: number,
    field: keyof NonNullable<TimeBlock['scrim']>,
    fieldValue: string | boolean | number | null,
  ) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    const currentScrim = newBlocks[blockIndex].scrim
    newBlocks[blockIndex] = {
      ...newBlocks[blockIndex],
      scrim: {
        opponentTeamId: currentScrim?.opponentTeamId ?? null,
        opponent: currentScrim?.opponent || '',
        opponentRoster: currentScrim?.opponentRoster || '',
        contact: currentScrim?.contact || '',
        host: currentScrim?.host || '',
        mapPool: currentScrim?.mapPool || '',
        heroBans: currentScrim?.heroBans ?? true,
        staggers: currentScrim?.staggers ?? false,
        notes: currentScrim?.notes || '',
        [field]: fieldValue,
      },
    }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update block time
  const updateBlockTime = (dayIndex: number, blockIndex: number, time: string) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], time }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Add a new time block to a day
  const addBlock = (dayIndex: number) => {
    const newDays = [...schedule.days]
    const lastBlock = newDays[dayIndex].blocks[newDays[dayIndex].blocks.length - 1]
    // Default to 2 hours after last block, or a sensible default
    const newTime = lastBlock?.time ? `${parseInt(lastBlock.time) + 2}-${parseInt(lastBlock.time) + 4} EST` : '10-12 EST'
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      blocks: [...newDays[dayIndex].blocks, createDefaultBlock(newTime)],
    }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Remove a block from a day
  const removeBlock = (dayIndex: number, blockIndex: number) => {
    const newDays = [...schedule.days]
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      blocks: newDays[dayIndex].blocks.filter((_, i) => i !== blockIndex),
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

  // Toggle "use all members" for a day
  const toggleUseAllMembers = (dayIndex: number) => {
    const newDays = [...schedule.days]
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      useAllMembers: !newDays[dayIndex].useAllMembers,
    }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Remove a day from the schedule (for manually created days)
  const removeDay = (dayIndex: number) => {
    const newDays = schedule.days.filter((_, i) => i !== dayIndex)
    updateSchedule({ ...schedule, days: newDays })
  }

  // Mark a block as having reminder posted
  const markBlockReminderPosted = (dayIndex: number, blockIndex: number) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], reminderPosted: true }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Update block scrim outcome
  const updateBlockOutcome = (dayIndex: number, blockIndex: number, outcome: TimeBlock['outcome']) => {
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], outcome }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Get assigned player IDs for a block (to filter dropdowns)
  const getAssignedPlayerIds = (dayIndex: number, blockIndex: number): Set<string> => {
    const block = schedule.days[dayIndex]?.blocks[blockIndex]
    if (!block) return new Set()
    return new Set(block.slots.map((s) => s.playerId).filter(Boolean) as string[])
  }

  // Re-initialize if votes change (but preserve existing assignments)
  useEffect(() => {
    if (votes && votes.length > 0 && schedule.days.length === 0) {
      updateSchedule(createInitialSchedule())
    }
  }, [votes, schedule.days.length, updateSchedule, createInitialSchedule])

  // Empty schedule - show setup wizard (takes priority over "no votes" message for new schedules)
  if (schedule.days.length === 0) {
    return (
      <div className="schedule-editor schedule-editor--setup">
        <div className="schedule-editor__setup-header">
          <span className="schedule-editor__setup-icon">🗓️</span>
          <h3>Create Your Schedule</h3>
          <p>Add scrim days to build your team's schedule. You can add days individually or generate a full week.</p>
        </div>
        
        <div className="schedule-editor__setup-options">
          {/* Quick setup - generate week */}
          <div className="schedule-editor__setup-card">
            <h4>📅 Generate Week</h4>
            <p>Create a full week of scrim days starting from:</p>
            <div className="schedule-editor__setup-row">
              <select 
                className="schedule-editor__setup-select"
                onChange={(e) => {
                  if (!e.target.value) return
                  const startMode = e.target.value
                  const today = new Date()
                  today.setHours(12, 0, 0, 0)
                  
                  let startDate = new Date(today)
                  if (startMode === 'tomorrow') {
                    startDate.setDate(startDate.getDate() + 1)
                  } else if (startMode === 'monday') {
                    const day = startDate.getDay()
                    const delta = day === 0 ? 1 : (8 - day)
                    startDate.setDate(startDate.getDate() + delta)
                  }
                  
                  // Generate 7 days
                  const newDays: DaySchedule[] = []
                  for (let i = 0; i < 7; i++) {
                    const date = new Date(startDate)
                    date.setDate(date.getDate() + i)
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
                    const monthName = date.toLocaleDateString('en-US', { month: 'long' })
                    const dayNum = date.getDate()
                    const suffix = ['th', 'st', 'nd', 'rd'][(dayNum % 10 > 3 || Math.floor(dayNum % 100 / 10) === 1) ? 0 : dayNum % 10]
                    
                    newDays.push({
                      date: `${dayName} ${monthName} ${dayNum}${suffix}`,
                      enabled: false, // Start disabled, user enables days they want
                      useAllMembers: true,
                      blocks: [createDefaultBlock(timeSlot || '8-10 EST')],
                    })
                  }
                  
                  updateSchedule({ ...schedule, days: newDays })
                  e.target.value = ''
                }}
              >
                <option value="">Select start...</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="monday">Next Monday</option>
              </select>
            </div>
          </div>
          
          {/* Manual - add single day */}
          <div className="schedule-editor__setup-card">
            <h4>➕ Add Single Day</h4>
            <p>Add individual scrim days one at a time:</p>
            <div className="schedule-editor__setup-row">
              <input
                type="date"
                className="schedule-editor__add-day-input"
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onChange={(e) => {
                  if (!e.target.value) return
                  const date = new Date(e.target.value + 'T12:00:00')
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
                  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
                  const dayNum = date.getDate()
                  const suffix = ['th', 'st', 'nd', 'rd'][(dayNum % 10 > 3 || Math.floor(dayNum % 100 / 10) === 1) ? 0 : dayNum % 10]
                  
                  const newDay: DaySchedule = {
                    date: `${dayName} ${monthName} ${dayNum}${suffix}`,
                    enabled: true,
                    useAllMembers: true,
                    blocks: [createDefaultBlock(timeSlot || '8-10 EST')],
                  }
                  updateSchedule({ ...schedule, days: [newDay] })
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="schedule-editor__setup-hint">
          💡 <strong>Tip:</strong> Make sure to select a <strong>Team</strong> and set the <strong>Time Slot</strong> in the sidebar before saving.
        </div>
      </div>
    )
  }

  return (
    <div className="schedule-editor">
      <div className="schedule-editor__header">
        <span className="schedule-editor__header-icon">📅</span>
        <span className="schedule-editor__header-title">Schedule Builder</span>
        <span className="schedule-editor__header-hint">
          {schedule.days.length > 0 
            ? 'Assign players to roles for each scrim day'
            : 'Create a schedule by adding scrim days'}
        </span>
        {team && (
          <button
            type="button"
            className="schedule-editor__analytics-btn"
            onClick={() => setShowAnalytics(true)}
          >
            📊 Scrim Analytics
          </button>
        )}
      </div>

      {/* Analytics Modal */}
      {showAnalytics && team && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="schedule-editor__analytics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__analytics-modal-header">
              <h3>📊 Scrim Analytics</h3>
              <button
                type="button"
                className="schedule-editor__analytics-close"
                onClick={() => setShowAnalytics(false)}
              >
                ×
              </button>
            </div>
            <div className="schedule-editor__analytics-modal-body">
              <ScrimAnalytics 
                teamId={typeof team === 'object' ? team.id : team}
                teamName={typeof team === 'object' ? team.name : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Standalone creation: Add days form */}
      <div className="schedule-editor__add-day-section">
        <label className="schedule-editor__add-day-label">Add Scrim Day:</label>
        <input
          type="date"
          className="schedule-editor__add-day-input"
          onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
          onChange={(e) => {
            if (e.target.value) {
              // Format date as "Day Month Xth" (e.g., "Monday January 20th")
              const date = new Date(e.target.value + 'T12:00:00')
              const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
              const monthName = date.toLocaleDateString('en-US', { month: 'long' })
              const dayNum = date.getDate()
              const suffix = ['th', 'st', 'nd', 'rd'][(dayNum % 10 > 3 || Math.floor(dayNum % 100 / 10) === 1) ? 0 : dayNum % 10]
              const formattedDate = `${dayName} ${monthName} ${dayNum}${suffix}`
              
              // Check if day already exists
              if (schedule.days.some(d => d.date === formattedDate)) {
                return
              }
              
              // Add new day
              const newDay: DaySchedule = {
                date: formattedDate,
                enabled: true,
                useAllMembers: true, // Default to all members for manual creation
                blocks: [createDefaultBlock(timeSlot || '8-10 EST')],
              }
              updateSchedule({
                ...schedule,
                days: [...schedule.days, newDay].sort((a, b) => {
                  // Sort by date - parse the formatted string back (e.g., "Wednesday January 21st")
                  const parseDate = (str: string) => {
                    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                                   'July', 'August', 'September', 'October', 'November', 'December']
                    const parts = str.split(' ')
                    if (parts.length < 3) return 0
                    const month = months.indexOf(parts[1])
                    // Remove ordinal suffix (st, nd, rd, th) from day number
                    const dayStr = parts[2].replace(/(st|nd|rd|th)$/i, '')
                    const day = parseInt(dayStr)
                    if (isNaN(day) || month === -1) return 0
                    return new Date(2026, month, day).getTime()
                  }
                  return parseDate(a.date) - parseDate(b.date)
                })
              })
              e.target.value = ''
            }
          }}
        />
      </div>

      <div className="schedule-editor__days">
        {schedule.days.map((day, dayIndex) => {
          // Use team members if "use all members" is checked, otherwise use voters
          const votersForDay = getAvailablePlayers(votes, day.date)
          const rawPlayers = day.useAllMembers ? teamMembers : votersForDay
          // Deduplicate by ID to avoid React key errors
          const availablePlayers = rawPlayers.filter((player, index, arr) => 
            arr.findIndex(p => p.id === player.id) === index
          )
          const voteData = votes?.find((v) => v.date === day.date)

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
                {voteData && (
                  <span className="schedule-editor__day-voters">
                    {voteData.voterCount} available
                  </span>
                )}
                {day.enabled && (
                  <label className="schedule-editor__use-all-toggle">
                    <input
                      type="checkbox"
                      checked={day.useAllMembers || false}
                      onChange={() => toggleUseAllMembers(dayIndex)}
                    />
                    <span>Use all team members</span>
                  </label>
                )}
                {/* Remove day button - only for manually created days (no poll data) */}
                {!voteData && (
                  <button
                    type="button"
                    className="schedule-editor__remove-day-btn"
                    onClick={() => removeDay(dayIndex)}
                    title="Remove this day"
                  >
                    🗑️
                  </button>
                )}
              </div>

              {day.enabled && (
                <div className="schedule-editor__day-content">
                  {day.blocks.map((block, blockIndex) => {
                    const assignedIds = getAssignedPlayerIds(dayIndex, blockIndex)
                    
                    return (
                      <div key={block.id} className="schedule-editor__block">
                        <div className="schedule-editor__block-header">
                          <input
                            type="text"
                            className="schedule-editor__block-time"
                            value={block.time}
                            onChange={(e) => updateBlockTime(dayIndex, blockIndex, e.target.value)}
                            placeholder="8-10 EST"
                          />
                          {day.blocks.length > 1 && (
                            <button
                              type="button"
                              className="schedule-editor__block-remove"
                              onClick={() => removeBlock(dayIndex, blockIndex)}
                              title="Remove this time block"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="schedule-editor__roles">
                          {block.slots.map((slot, slotIndex) => {
                            const filteredPlayers = availablePlayers.filter(
                              (p) => !assignedIds.has(p.id) || p.id === slot.playerId,
                            )

                            return (
                              <div key={slotIndex} className={`schedule-editor__role-row ${slot.isRinger ? 'schedule-editor__role-row--ringer' : ''}`}>
                                <input
                                  type="text"
                                  className="schedule-editor__role-input"
                                  value={slot.role}
                                  onChange={(e) => updateSlotRole(dayIndex, blockIndex, slotIndex, e.target.value)}
                                  placeholder="Role..."
                                />
                                
                                {/* Ringer checkbox */}
                                <label className="schedule-editor__ringer-toggle" title="Mark as ringer (external player)">
                                  <input
                                    type="checkbox"
                                    checked={slot.isRinger || false}
                                    onChange={() => toggleSlotRinger(dayIndex, blockIndex, slotIndex)}
                                  />
                                  <span className="schedule-editor__ringer-label">R</span>
                                </label>
                                
                                {/* Normal player dropdown OR Ringer autocomplete */}
                                {slot.isRinger ? (
                                  <div className="schedule-editor__ringer-autocomplete">
                                    <input
                                      type="text"
                                      className="schedule-editor__ringer-input"
                                      placeholder="Search or type ringer name..."
                                      value={slot.ringerName || ''}
                                      onChange={(e) => updateRingerName(dayIndex, blockIndex, slotIndex, e.target.value)}
                                    />
                                    {slot.ringerName && !slot.playerId && allPeople.filter(p => 
                                      p.name.toLowerCase().includes((slot.ringerName || '').toLowerCase())
                                    ).length > 0 && (
                                      <div className="schedule-editor__autocomplete-dropdown">
                                        {allPeople
                                          .filter(p => p.name.toLowerCase().includes((slot.ringerName || '').toLowerCase()))
                                          .slice(0, 6)
                                          .map(person => (
                                            <button
                                              key={person.id}
                                              type="button"
                                              className="schedule-editor__autocomplete-option"
                                              onClick={() => updateRingerName(dayIndex, blockIndex, slotIndex, person.name, person.id)}
                                            >
                                              {person.name}
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                    {slot.playerId && (
                                      <span className="schedule-editor__autocomplete-linked">✓</span>
                                    )}
                                  </div>
                                ) : (
                                  <select
                                    className="schedule-editor__role-select"
                                    value={slot.playerId || ''}
                                    onChange={(e) =>
                                      assignSlot(dayIndex, blockIndex, slotIndex, e.target.value || null)
                                    }
                                  >
                                    <option value="">— Select —</option>
                                    {filteredPlayers.map((player) => (
                                      <option key={player.id} value={player.id}>
                                        {player.displayName || player.username}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                
                                {slotIndex >= roles.length && (
                                  <button
                                    type="button"
                                    className="schedule-editor__remove-btn"
                                    onClick={() => removeSlot(dayIndex, blockIndex, slotIndex)}
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
                            onClick={() => addExtraPlayer(dayIndex, blockIndex)}
                          >
                            + Add Player
                          </button>
                        </div>

                        <div className="schedule-editor__scrim">
                          <div className="schedule-editor__scrim-header">Scrim Details</div>
                          <div className="schedule-editor__scrim-fields">
                            <div className="schedule-editor__scrim-field schedule-editor__scrim-field--autocomplete">
                              <label>Opponent:</label>
                              <div className="schedule-editor__autocomplete">
                                <input
                                  type="text"
                                  placeholder="Search or type team name..."
                                  value={block.scrim?.opponent || ''}
                                  onChange={(e) => {
                                    updateBlockScrim(dayIndex, blockIndex, 'opponent', e.target.value)
                                    if (block.scrim?.opponentTeamId) {
                                      const team = opponentTeams.find(t => t.id === block.scrim?.opponentTeamId)
                                      if (team && team.name !== e.target.value) {
                                        updateBlockScrim(dayIndex, blockIndex, 'opponentTeamId', null)
                                      }
                                    }
                                  }}
                                />
                                {block.scrim?.opponent && !block.scrim?.opponentTeamId && opponentTeams.filter(t => 
                                  t.name.toLowerCase().includes((block.scrim?.opponent || '').toLowerCase())
                                ).length > 0 && (
                                  <div className="schedule-editor__autocomplete-dropdown">
                                    {opponentTeams
                                      .filter(t => t.name.toLowerCase().includes((block.scrim?.opponent || '').toLowerCase()))
                                      .slice(0, 8)
                                      .map(team => (
                                        <button
                                          key={team.id}
                                          type="button"
                                          className="schedule-editor__autocomplete-option"
                                          onClick={() => {
                                            updateBlockScrim(dayIndex, blockIndex, 'opponentTeamId', team.id)
                                            updateBlockScrim(dayIndex, blockIndex, 'opponent', team.name)
                                          }}
                                        >
                                          {team.name}
                                        </button>
                                      ))}
                                  </div>
                                )}
                                {block.scrim?.opponentTeamId && (
                                  <span className="schedule-editor__autocomplete-linked">✓ Linked</span>
                                )}
                              </div>
                            </div>
                            <div className="schedule-editor__scrim-field">
                              <label>Contact:</label>
                              <input
                                type="text"
                                placeholder="e.g., Username#1234"
                                value={block.scrim?.contact || ''}
                                onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'contact', e.target.value)}
                              />
                            </div>
                            <div className="schedule-editor__scrim-field">
                              <label>Host:</label>
                              <select
                                value={block.scrim?.host || ''}
                                onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'host', e.target.value)}
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
                                value={block.scrim?.mapPool || ''}
                                onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'mapPool', e.target.value)}
                              />
                            </div>
                            <div className="schedule-editor__scrim-field">
                              <label>Hero Bans:</label>
                              <div className="schedule-editor__toggle">
                                <label className="schedule-editor__toggle-label">
                                  <input
                                    type="checkbox"
                                    checked={block.scrim?.heroBans ?? true}
                                    onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'heroBans', e.target.checked)}
                                  />
                                  <span>{block.scrim?.heroBans ?? true ? 'On' : 'Off'}</span>
                                </label>
                              </div>
                            </div>
                            <div className="schedule-editor__scrim-field">
                              <label>Staggers:</label>
                              <div className="schedule-editor__toggle">
                                <label className="schedule-editor__toggle-label">
                                  <input
                                    type="checkbox"
                                    checked={block.scrim?.staggers ?? false}
                                    onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'staggers', e.target.checked)}
                                  />
                                  <span>{block.scrim?.staggers ? 'On' : 'Off'}</span>
                                </label>
                              </div>
                            </div>
                            <div className="schedule-editor__scrim-field schedule-editor__scrim-field--full">
                              <label>Opponent Roster:</label>
                              <textarea
                                placeholder="Paste opponent roster here..."
                                rows={3}
                                value={block.scrim?.opponentRoster || ''}
                                onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'opponentRoster', e.target.value)}
                              />
                            </div>
                            <div className="schedule-editor__scrim-field schedule-editor__scrim-field--full">
                              <label>Notes:</label>
                              <input
                                type="text"
                                placeholder="Any additional notes..."
                                value={block.scrim?.notes || ''}
                                onChange={(e) => updateBlockScrim(dayIndex, blockIndex, 'notes', e.target.value)}
                              />
                            </div>
                            <div className="schedule-editor__scrim-actions">
                              <ReminderButton 
                                dayDate={day.date}
                                blockTime={block.time}
                                hasOpponent={Boolean(block.scrim?.opponent)}
                                reminderPosted={block.reminderPosted}
                                onReminderPosted={() => markBlockReminderPosted(dayIndex, blockIndex)}
                              />
                              <ScrimOutcomeButton
                                opponentName={block.scrim?.opponent || ''}
                                outcome={block.outcome}
                                onSaveOutcome={(outcome) => updateBlockOutcome(dayIndex, blockIndex, outcome)}
                                availableMaps={maps}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    className="schedule-editor__add-block-btn"
                    onClick={() => addBlock(dayIndex)}
                  >
                    ➕ Add Time Block
                  </button>
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

// Reminder button component for per-block scrim posts
interface ReminderButtonProps {
  dayDate: string
  blockTime?: string
  hasOpponent: boolean
  reminderPosted?: boolean
  onReminderPosted: () => void
}

const ReminderButton: React.FC<ReminderButtonProps> = ({ 
  dayDate, 
  blockTime,
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
      const result = await postScrimReminderAction(Number(id), dayDate, blockTime)
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

// Scrim Outcome button component with modal
interface ScrimOutcomeButtonProps {
  opponentName: string
  outcome?: TimeBlock['outcome']
  onSaveOutcome: (outcome: TimeBlock['outcome']) => void
  availableMaps: Array<{id: number, name: string}>
}

const ScrimOutcomeButton: React.FC<ScrimOutcomeButtonProps> = ({
  opponentName,
  outcome,
  onSaveOutcome,
  availableMaps,
}) => {
  const [showModal, setShowModal] = useState(false)
  const [localOutcome, setLocalOutcome] = useState<NonNullable<TimeBlock['outcome']>>(outcome || {})
  const [newMap, setNewMap] = useState({ mapName: '', result: '' as 'win' | 'loss' | 'draw' | '', score: '' })
  const [showMapDropdown, setShowMapDropdown] = useState(false)

  useEffect(() => {
    if (showModal) {
      setLocalOutcome(outcome || {})
    }
  }, [showModal, outcome])

  const handleSave = () => {
    // Validate all maps in the list are valid
    const invalidMaps = (localOutcome.mapsPlayed || []).filter(
      m => !availableMaps.some(am => am.name.toLowerCase() === m.mapName.toLowerCase())
    )
    if (invalidMaps.length > 0) {
      toast.error(`Invalid map(s): ${invalidMaps.map(m => m.mapName).join(', ')}. Please select from the dropdown.`)
      return
    }
    onSaveOutcome(localOutcome)
    setShowModal(false)
    toast.success('Scrim outcome saved!')
  }

  const addMap = () => {
    // Only add if there's at least a map name
    if (!newMap.mapName.trim()) return
    // Find exact map name if it exists (for proper casing)
    const exactMap = availableMaps.find(m => m.name.toLowerCase() === newMap.mapName.toLowerCase())
    const mapsPlayed = localOutcome.mapsPlayed || []
    setLocalOutcome({
      ...localOutcome,
      mapsPlayed: [...mapsPlayed, { mapName: exactMap?.name || newMap.mapName, result: (newMap.result || 'win') as 'win' | 'loss' | 'draw', score: newMap.score }],
    })
    setNewMap({ mapName: '', result: '', score: '' })
  }

  const removeMap = (index: number) => {
    const mapsPlayed = [...(localOutcome.mapsPlayed || [])]
    mapsPlayed.splice(index, 1)
    setLocalOutcome({ ...localOutcome, mapsPlayed })
  }

  // Check if any maps in the list are invalid
  const hasInvalidMaps = (localOutcome.mapsPlayed || []).some(
    m => !availableMaps.some(am => am.name.toLowerCase() === m.mapName.toLowerCase())
  )

  // Check if there's a pending map entry that's invalid (typed but not added)
  const hasPendingInvalidMap = newMap.mapName.trim() !== '' && 
    !availableMaps.some(am => am.name.toLowerCase() === newMap.mapName.toLowerCase())

  // Block save if any invalid maps or pending invalid input
  const cannotSave = hasInvalidMaps || hasPendingInvalidMap

  const hasOutcome = Boolean(outcome?.ourRating || outcome?.mapsPlayed?.length)

  return (
    <>
      <button
        type="button"
        className={`schedule-editor__outcome-btn ${hasOutcome ? 'schedule-editor__outcome-btn--filled' : ''}`}
        onClick={() => setShowModal(true)}
      >
        {hasOutcome ? '📊 View Outcome' : '📊 Set Outcome'}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-editor__modal schedule-editor__modal--outcome" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon">📊</span>
              <h3>Scrim Outcome{opponentName ? ` vs ${opponentName}` : ''}</h3>
            </div>
            <div className="schedule-editor__modal-body schedule-editor__outcome-form">
              {/* Ratings Row */}
              <div className="schedule-editor__outcome-row">
                <div className="schedule-editor__outcome-field">
                  <label>Our Performance</label>
                  <select
                    value={localOutcome.ourRating || ''}
                    onChange={(e) => setLocalOutcome({ ...localOutcome, ourRating: e.target.value as any || undefined })}
                  >
                    <option value="">— Select —</option>
                    <option value="easywin">✅ Easy Win</option>
                    <option value="closewin">🔥 Close Win</option>
                    <option value="neutral">😐 Neutral</option>
                    <option value="closeloss">😓 Close Loss</option>
                    <option value="gotrolled">💀 Got Rolled</option>
                  </select>
                </div>
                <div className="schedule-editor__outcome-field">
                  <label>Opponent Strength</label>
                  <select
                    value={localOutcome.opponentRating || ''}
                    onChange={(e) => setLocalOutcome({ ...localOutcome, opponentRating: e.target.value as any || undefined })}
                  >
                    <option value="">— Select —</option>
                    <option value="weak">🟢 Weak</option>
                    <option value="average">🟡 Average</option>
                    <option value="strong">🔴 Strong</option>
                    <option value="verystrong">💀 Very Strong</option>
                  </select>
                </div>
                <div className="schedule-editor__outcome-field">
                  <label>Scrim Again?</label>
                  <select
                    value={localOutcome.worthScrimAgain || ''}
                    onChange={(e) => setLocalOutcome({ ...localOutcome, worthScrimAgain: e.target.value as any || undefined })}
                  >
                    <option value="">— Select —</option>
                    <option value="yes">👍 Yes</option>
                    <option value="maybe">🤔 Maybe</option>
                    <option value="no">👎 No</option>
                  </select>
                </div>
              </div>

              {/* Maps Played */}
              <div className="schedule-editor__outcome-maps">
                <label>Maps Played</label>
                {localOutcome.mapsPlayed && localOutcome.mapsPlayed.length > 0 && (
                  <div className="schedule-editor__outcome-map-list">
                    {localOutcome.mapsPlayed.map((m, i) => {
                      const isInvalidMap = !availableMaps.some(am => am.name.toLowerCase() === m.mapName.toLowerCase())
                      return (
                        <div key={i} className={`schedule-editor__outcome-map-item schedule-editor__outcome-map-item--${m.result} ${isInvalidMap ? 'schedule-editor__outcome-map-item--invalid' : ''}`}>
                          <span>{isInvalidMap ? '⚠️ ' : ''}{m.mapName}</span>
                          <span className="schedule-editor__outcome-map-result">
                            {m.result === 'win' ? '✅ W' : m.result === 'loss' ? '❌ L' : '🔄 D'}
                            {m.score && ` (${m.score})`}
                          </span>
                          <button type="button" onClick={() => removeMap(i)}>×</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="schedule-editor__outcome-add-map">
                  <div className="schedule-editor__map-autocomplete">
                    <input
                      type="text"
                      placeholder="Search map..."
                      value={newMap.mapName}
                      onChange={(e) => {
                        setNewMap({ ...newMap, mapName: e.target.value })
                        setShowMapDropdown(true)
                      }}
                      onFocus={() => setShowMapDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMapDropdown(false), 200)}
                    />
                    {showMapDropdown && newMap.mapName && availableMaps.filter(m => 
                      m.name.toLowerCase().includes(newMap.mapName.toLowerCase())
                    ).length > 0 && (
                      <div className="schedule-editor__map-dropdown">
                        {availableMaps
                          .filter(m => m.name.toLowerCase().includes(newMap.mapName.toLowerCase()))
                          .slice(0, 8)
                          .map(map => (
                            <button
                              key={map.id}
                              type="button"
                              onClick={() => {
                                setNewMap({ ...newMap, mapName: map.name })
                                setShowMapDropdown(false)
                              }}
                            >
                              {map.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <select
                    value={newMap.result}
                    onChange={(e) => setNewMap({ ...newMap, result: e.target.value as any })}
                  >
                    <option value="">Result</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="draw">Draw</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Score"
                    value={newMap.score}
                    onChange={(e) => setNewMap({ ...newMap, score: e.target.value })}
                  />
                  <button type="button" onClick={addMap}>+</button>
                </div>
              </div>

              {/* Notes */}
              <div className="schedule-editor__outcome-field schedule-editor__outcome-field--full">
                <label>Notes</label>
                <textarea
                  placeholder="Areas to improve, observations..."
                  rows={3}
                  value={localOutcome.scrimNotes || ''}
                  onChange={(e) => setLocalOutcome({ ...localOutcome, scrimNotes: e.target.value })}
                />
              </div>
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
                className={`schedule-editor__modal-confirm schedule-editor__modal-confirm--outcome ${cannotSave ? 'schedule-editor__modal-confirm--disabled' : ''}`}
                onClick={handleSave}
                disabled={cannotSave}
                title={cannotSave ? 'Fix invalid map names first' : 'Save outcome'}
              >
                {cannotSave ? '⚠️ Fix Invalid Maps' : 'Save Outcome'}
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
              {isModified ? (
                <p className="schedule-editor__modal-warning">
                  ⚠️ <strong>Unsaved changes!</strong> Please save the document first before publishing. 
                  The publish action uses saved data from the database.
                </p>
              ) : (
                <p>This will post the schedule to the team's <strong>Calendar thread</strong> on Discord.</p>
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
                className="schedule-editor__modal-confirm"
                onClick={handlePublish}
                disabled={isModified}
                title={isModified ? 'Save your changes first' : 'Publish to Discord'}
              >
                {isModified ? '💾 Save First' : 'Publish to Discord'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ScheduleEditor
