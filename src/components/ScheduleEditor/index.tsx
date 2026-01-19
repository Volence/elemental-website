'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useField, useFormFields, useDocumentInfo, toast } from '@payloadcms/ui'
import { ScrimAnalytics } from '@/components/ScrimAnalytics'

// Extracted sub-components
import { ReminderButton } from './ReminderButton'
import { PublishButton } from './PublishButton'
import { ScrimOutcomeButton } from './ScrimOutcomeButton'
import type { TimeBlock, TimeBlockOutcome, PlayerSlot, DaySchedule, ScheduleData, VoteData, LegacyScrim } from './types'

import './index.scss'

// Role presets matching Teams collection
const rolePresets: Record<string, string[]> = {
  'ow2-specific': ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
  'generic': ['Tank', 'DPS', 'DPS', 'Support', 'Support'],
  'custom': [], // Will use customRoles from team
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

  // Fetch team members and role preset when team is available
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!team) return
      const teamId = typeof team === 'object' ? team.id : team
      if (!teamId) return
      
      try {
        // Fetch team with populated roster (depth=1 populates the person relationship)
        const res = await fetch(`/api/teams/${teamId}?depth=1`)
        if (res.ok) {
          const teamData = await res.json()
          
          // Set team members from roster AND subs
          const roster = teamData.roster || []
          const subs = teamData.subs || []
          
          // Map roster members
          const rosterMembers = roster
            .filter((entry: any) => entry.person && typeof entry.person === 'object')
            .map((entry: any) => ({
              id: String(entry.person.id),
              username: entry.person.name || 'Unknown',
              displayName: entry.person.name || 'Unknown',
            }))
          
          // Map subs (they have a person field too)
          const subMembers = subs
            .filter((entry: any) => entry.person && typeof entry.person === 'object')
            .map((entry: any) => ({
              id: String(entry.person.id),
              username: entry.person.name || 'Unknown',
              displayName: `${entry.person.name || 'Unknown'} (Sub)`,
            }))
          
          // Combine roster and subs, deduplicate by ID
          const allMembers = [...rosterMembers, ...subMembers]
          const uniqueMembers = allMembers.filter((member, index, arr) => 
            arr.findIndex(m => m.id === member.id) === index
          )
          
          console.log('Team members loaded:', rosterMembers.length, 'roster +', subMembers.length, 'subs')
          setTeamMembers(uniqueMembers)
          
          // Set roles from team's rolePreset (at root level, not in discordThreads)
          // Teams collection uses 'specific' but our preset map uses 'ow2-specific'
          let preset = teamData.rolePreset || 'ow2-specific'
          if (preset === 'specific') preset = 'ow2-specific' // Map Teams value to preset key
          
          console.log('Team rolePreset:', teamData.rolePreset, '-> using:', preset)
          
          if (preset === 'custom' && teamData.customRoles) {
            // customRoles is comma-separated string, convert to array
            const customRolesArray = teamData.customRoles.split(',').map((r: string) => r.trim()).filter(Boolean)
            if (customRolesArray.length > 0) {
              console.log('Setting custom roles:', customRolesArray)
              setRoles(customRolesArray)
            }
          } else if (rolePresets[preset]) {
            console.log('Setting preset roles:', rolePresets[preset])
            setRoles(rolePresets[preset])
          }
        }
      } catch (error) {
        console.error('Failed to fetch team data:', error)
      }
    }
    fetchTeamData()
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

  // Update existing block slots when team's role preset changes
  // Only migrate blocks that have FEWER slots than the preset (upgrading old data)
  // Never remove extra slots or overwrite user-customized roles
  const rolesKey = roles.join('|')
  useEffect(() => {
    // Use functional update to get current schedule without depending on it
    setSchedule(currentSchedule => {
      if (currentSchedule.days.length === 0 || roles.length === 0) return currentSchedule
      
      // Only migrate blocks that need MORE slots (upgrading from older preset)
      // Never migrate blocks that have extra slots (user added them intentionally)
      const needsMigration = currentSchedule.days.some(day => 
        day.blocks.some(block => {
          // If block has MORE slots than preset, user added extras - don't migrate
          if (block.slots.length > roles.length) return false
          // If block has FEWER slots than preset, it needs upgrading
          if (block.slots.length < roles.length) return true
          // Same slot count - only migrate if the ENTIRE block matches a complete preset exactly
          // (meaning user hasn't customized any roles)
          const commonPresets = [
            ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
            ['Tank', 'DPS', 'DPS', 'Support', 'Support'],
          ]
          const existingRoles = block.slots.map(s => s.role)
          const matchesAnyPresetExactly = commonPresets.some(preset => 
            preset.every((role, i) => role === existingRoles[i])
          )
          // If block doesn't match any preset exactly, user has customized - don't migrate
          if (!matchesAnyPresetExactly) return false
          // Check if current roles match the new preset (team's setting)
          const rolesMatch = roles.every((role, i) => role === block.slots[i]?.role)
          return !rolesMatch
        })
      )
      
      if (!needsMigration) return currentSchedule
      
      console.log('Migrating blocks to new role preset:', roles)
      
      const migratedDays = currentSchedule.days.map(day => ({
        ...day,
        blocks: day.blocks.map(block => {
          // If block has more slots than preset, preserve everything
          if (block.slots.length > roles.length) {
            return block
          }
          // Upgrade: create preset slots + preserve any existing player assignments + any extras
          const presetSlots = roles.map((role, i) => {
            const existingSlot = block.slots[i]
            return {
              role,
              playerId: existingSlot?.playerId || null,
              isRinger: existingSlot?.isRinger,
              ringerName: existingSlot?.ringerName,
            }
          })
          // Preserve any extra slots beyond preset length
          const extraSlots = block.slots.slice(roles.length)
          return { ...block, slots: [...presetSlots, ...extraSlots] }
        })
      }))
      
      return { ...currentSchedule, days: migratedDays }
    })
  }, [rolesKey]) // Depend on roles content, not reference

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
    const day = newDays[dayIndex]
    const willBeEnabled = !day.enabled
    
    // When enabling a day, update block times to use the current timeSlot field value
    if (willBeEnabled && timeSlot) {
      newDays[dayIndex] = {
        ...day,
        enabled: true,
        blocks: day.blocks.map(block => ({
          ...block,
          time: timeSlot // Apply the current timeSlot setting
        }))
      }
    } else {
      newDays[dayIndex] = {
        ...day,
        enabled: willBeEnabled,
      }
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

export default ScheduleEditor
