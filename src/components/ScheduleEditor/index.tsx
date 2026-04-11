'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useField, useFormFields, useDocumentInfo, toast } from '@payloadcms/ui'
import { Calendar, CalendarPlus, BarChart3, Trash2, Plus, Lightbulb, X, ChevronDown, ChevronRight } from 'lucide-react'
import { ScrimAnalytics } from '@/components/ScrimAnalytics'

// Extracted sub-components
import { ReminderButton } from './ReminderButton'
import { PublishButton } from './PublishButton'
import { ScrimOutcomeButton } from './ScrimOutcomeButton'
import type { TimeBlock, TimeBlockOutcome, PlayerSlot, DaySchedule, ScheduleData, VoteData, LegacyScrim } from './types'
import { normalizeCalendarToVoteData } from './normalizeCalendarData'

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
  const { id, collectionSlug } = useDocumentInfo()
  
  // Get votes, timeSlot, team, and schedule type from form
  const votesField = useFormFields(([fields]) => fields['votes'])
  const timeSlotField = useFormFields(([fields]) => fields['timeSlot'])
  const teamField = useFormFields(([fields]) => fields['team'])
  const scheduleTypeField = useFormFields(([fields]) => fields['scheduleType'])
  
  const pollVotes = votesField?.value as VoteData[] | null
  const timeSlot = (timeSlotField?.value as string) || '8-10 EST'
  const team = teamField?.value as any
  const scheduleType = (scheduleTypeField?.value as string) || 'poll'

  // Calendar-sourced votes (normalized from calendar responses on SAME document)
  const [calendarVotes, setCalendarVotes] = useState<VoteData[] | null>(null)
  
  // Use the appropriate vote data based on schedule type
  const votes = scheduleType === 'calendar' ? calendarVotes : pollVotes

  // Determine roles based on team preset
  const [roles, setRoles] = useState<string[]>(rolePresets['ow2-specific'])
  
  // Opponent teams for dropdown
  const [opponentTeams, setOpponentTeams] = useState<Array<{id: number, name: string}>>([])
  
  // Team members for "use all team members" option
  const [teamMembers, setTeamMembers] = useState<Array<{id: string, username: string, displayName: string}>>([])
  
  // Team roster with role mappings for auto-fill
  const [teamRosterRoles, setTeamRosterRoles] = useState<Map<string, string>>(new Map())
  
  // Discord ID → Person ID mapping for matching calendar voters to roster members
  const [discordToPersonId, setDiscordToPersonId] = useState<Map<string, string>>(new Map())
  
  // All people for ringer autocomplete
  const [allPeople, setAllPeople] = useState<Array<{id: number, name: string}>>([])
  
  // Maps for outcome autocomplete
  const [maps, setMaps] = useState<Array<{id: number, name: string}>>([])
  
  // Analytics modal state
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  // Track which day cards are expanded (collapsed by default)
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  
  // Track which time blocks are expanded within each day (collapsed by default)
  // Keys are "dayIndex-blockIndex" strings
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  
  // For calendar-type schedules, fetch responses from the same document's API
  useEffect(() => {
    if (scheduleType !== 'calendar' || !id) {
      setCalendarVotes(null)
      return
    }

    const fetchCalendarData = async () => {
      try {
        const slug = collectionSlug || 'discord-polls'
        const res = await fetch(`/api/${slug}/${id}?depth=0`)
        if (!res.ok) return
        const doc = await res.json()
        
        const responses = doc.responses || []
        const start = doc.dateRange?.start
        const end = doc.dateRange?.end
        
        if (!start || !end || responses.length === 0) {
          setCalendarVotes([])
          return
        }
        
        const normalized = normalizeCalendarToVoteData(responses, start, end, doc.timeSlots)
        setCalendarVotes(normalized)
      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
        setCalendarVotes(null)
      }
    }

    fetchCalendarData()
  }, [scheduleType, id, collectionSlug])
  
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
          
          setTeamMembers(uniqueMembers)
          
          // Build role mapping for auto-fill (person ID → role category)
          const roleMap = new Map<string, string>()
          for (const entry of roster) {
            const p = entry.person
            if (p && typeof p === 'object') {
              roleMap.set(String(p.id), entry.role || '')
            }
          }
          setTeamRosterRoles(roleMap)
          
          // Build discordId → personId mapping for matching calendar voters
          const discordMap = new Map<string, string>()
          for (const entry of [...roster, ...subs]) {
            const p = entry.person
            if (p && typeof p === 'object' && p.discordId) {
              discordMap.set(String(p.discordId), String(p.id))
            }
          }
          setDiscordToPersonId(discordMap)
          
          // Set roles from team's rolePreset (at root level, not in discordThreads)
          // Teams collection uses 'specific' but our preset map uses 'ow2-specific'
          let preset = teamData.rolePreset || 'ow2-specific'
          if (preset === 'specific') preset = 'ow2-specific' // Map Teams value to preset key
          
          
          if (preset === 'custom' && teamData.customRoles) {
            // customRoles is comma-separated string, convert to array
            const customRolesArray = teamData.customRoles.split(',').map((r: string) => r.trim()).filter(Boolean)
            if (customRolesArray.length > 0) {
              setRoles(customRolesArray)
            }
          } else if (rolePresets[preset]) {
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
      // Create from vote/calendar data
      return {
        days: votes.map((v) => {
          // Calendar-type: create a block per time slot
          if (v.timeSlots && v.timeSlots.length > 0) {
            return {
              date: v.date,
              enabled: false, // Default unchecked — user enables days they want
              useAllMembers: false,
              blocks: v.timeSlots.map((slot) => createDefaultBlock(slot.time)),
            }
          }
          // Poll-type: single block
          return {
            date: v.date,
            enabled: false, // Default unchecked
            useAllMembers: false,
            blocks: [createDefaultBlock(timeSlot || '8-10 EST')],
          }
        }),
        lastUpdated: new Date().toISOString(),
      }
    }
    // Empty schedule - will be populated by standalone creation UI
    return { days: [], lastUpdated: new Date().toISOString() }
  }, [value, votes, timeSlot, createDefaultBlock, migrateToBlocks])

  const [schedule, setSchedule] = useState<ScheduleData>(createInitialSchedule)

  // Re-create the schedule when calendar votes arrive asynchronously 
  // (calendar data fetches after initial render, so schedule starts empty)
  useEffect(() => {
    if (!votes || votes.length === 0) return
    setSchedule(current => {
      // Only re-create if schedule is currently empty (no days)
      if (current.days.length > 0) return current
      return createInitialSchedule()
    })
  }, [votes, createInitialSchedule])

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
      
      
      const migratedDays = currentSchedule.days.map(day => ({
        ...day,
        blocks: day.blocks.map(block => {
          // If block has more slots than preset, preserve everything
          if (block.slots.length > roles.length) {
            return block
          }
          // If block has same slot count, only migrate if it matches a preset exactly
          if (block.slots.length === roles.length) {
            const commonPresets = [
              ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
              ['Tank', 'DPS', 'DPS', 'Support', 'Support'],
            ]
            const existingRoles = block.slots.map(s => s.role)
            const matchesAnyPresetExactly = commonPresets.some(preset => 
              preset.every((role, i) => role === existingRoles[i])
            )
            // If block doesn't match any preset exactly, user has customized - don't migrate
            if (!matchesAnyPresetExactly) {
              return block
            }
            // Block matches a preset but maybe not the team's current preset - migrate to new preset
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

  // When calendar votes arrive with per-slot data, upgrade single-block days to multi-block  
  useEffect(() => {
    if (!votes || scheduleType !== 'calendar') return
    
    setSchedule(currentSchedule => {
      if (currentSchedule.days.length === 0) return currentSchedule
      
      // Check if any day needs block upgrading
      let needsUpgrade = false
      for (const day of currentSchedule.days) {
        const voteData = votes.find(v => v.date === day.date)
        if (voteData?.timeSlots && voteData.timeSlots.length > 1 && day.blocks.length === 1) {
          needsUpgrade = true
          break
        }
      }
      
      if (!needsUpgrade) return currentSchedule
      
      const upgradedDays = currentSchedule.days.map(day => {
        const voteData = votes.find(v => v.date === day.date)
        if (!voteData?.timeSlots || voteData.timeSlots.length <= 1 || day.blocks.length > 1) {
          return day
        }
        
        // Upgrade: create one block per time slot, preserving data from the first block
        const existingBlock = day.blocks[0]
        return {
          ...day,
          blocks: voteData.timeSlots.map(slot => ({
            ...createDefaultBlock(slot.time),
            slots: existingBlock.slots.map(s => ({ ...s, playerId: null })), // Fresh slots per block
          })),
        }
      })
      
      return { ...currentSchedule, days: upgradedDays }
    })
  }, [votes, scheduleType, createDefaultBlock])

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
    // (but only for non-calendar schedules — calendar blocks already have correct times)
    if (willBeEnabled && timeSlot && scheduleType !== 'calendar') {
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
    
    // Auto-expand when enabling, auto-collapse when disabling
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (willBeEnabled) {
        next.add(dayIndex)
      } else {
        next.delete(dayIndex)
      }
      return next
    })
    
    // Auto-expand first block when enabling a day
    if (willBeEnabled && newDays[dayIndex].blocks.length > 0) {
      setExpandedBlocks(prev => {
        const next = new Set(prev)
        next.add(`${dayIndex}-0`)
        return next
      })
    } else if (!willBeEnabled) {
      // Collapse all blocks when disabling
      setExpandedBlocks(prev => {
        const next = new Set(prev)
        for (let i = 0; i < newDays[dayIndex].blocks.length; i++) {
          next.delete(`${dayIndex}-${i}`)
        }
        return next
      })
    }
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

  // ──── Workflow Automation ────

  // Map a team roster role to matching schedule slot roles
  const roleMatchesSlot = (rosterRole: string, slotRole: string): boolean => {
    const normalized = rosterRole.toLowerCase()
    const slot = slotRole.toLowerCase()
    if (normalized === 'tank' && slot === 'tank') return true
    if (normalized === 'dps' && (slot.includes('dps') || slot.includes('hitscan') || slot.includes('flex dps'))) return true
    if (normalized === 'support' && (slot.includes('support'))) return true
    // Generic fallback
    if (normalized === slot) return true
    return false
  }

  // Auto-fill a single block using available players + team roster roles
  const autoFillBlock = (dayIndex: number, blockIndex: number) => {
    const day = schedule.days[dayIndex]
    if (!day) return

    const block = day.blocks[blockIndex]
    if (!block) return

    // Get vote data for this day to find per-slot availability
    const voteData = votes?.find(v => v.date === day.date)
    
    // Get available player IDs for this specific time slot
    const slotVoters = voteData?.timeSlots?.find(ts => ts.time === block.time)?.voters
    const dayVoters = voteData?.voters || []
    const availableForSlot = slotVoters || dayVoters

    // Build player pool with role info
    // When "All members" is on, treat everyone as available (that's the whole point)
    const useAll = day.useAllMembers
    const playerPool: Array<{ id: string; name: string; rosterRole: string; isAvailable: boolean }> = []
    
    for (const member of teamMembers) {
      const rosterRole = teamRosterRoles.get(member.id) || ''
      // Check availability: match by person ID, discord→person mapping, or username
      const isAvailable = useAll || availableForSlot.some(v => {
        if (v.id === member.id) return true
        // Calendar voters use discordId; check if it maps to this person
        const mappedPersonId = discordToPersonId.get(v.id)
        if (mappedPersonId === member.id) return true
        // Fallback: username match
        if (v.username === member.username) return true
        return false
      })
      playerPool.push({
        id: member.id,
        name: member.username,
        rosterRole,
        isAvailable,
      })
    }

    // Sort: available players first, then by roster role match
    const newSlots = [...block.slots]
    const assigned = new Set<string>()

    // First pass: assign available players to matching roles
    for (let i = 0; i < newSlots.length; i++) {
      if (newSlots[i].playerId) {
        assigned.add(newSlots[i].playerId!)
        continue // Already assigned, skip
      }
      
      const slot = newSlots[i]
      // Find best match: available + matching role
      const match = playerPool.find(p => 
        !assigned.has(p.id) && 
        p.isAvailable && 
        roleMatchesSlot(p.rosterRole, slot.role)
      )
      if (match) {
        newSlots[i] = { ...slot, playerId: match.id }
        assigned.add(match.id)
      }
    }

    // Second pass: fill remaining empty slots with any available player
    for (let i = 0; i < newSlots.length; i++) {
      if (newSlots[i].playerId) continue
      const slot = newSlots[i]
      const fallback = playerPool.find(p => !assigned.has(p.id) && p.isAvailable)
      if (fallback) {
        newSlots[i] = { ...slot, playerId: fallback.id }
        assigned.add(fallback.id)
      }
    }

    // Update schedule
    const newDays = [...schedule.days]
    const newBlocks = [...newDays[dayIndex].blocks]
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
    newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
    updateSchedule({ ...schedule, days: newDays })
  }

  // Auto-fill ALL enabled blocks across all days
  const autoFillAll = () => {
    let newDays = [...schedule.days]
    
    for (let dayIndex = 0; dayIndex < newDays.length; dayIndex++) {
      const day = newDays[dayIndex]
      if (!day.enabled) continue

      const voteData = votes?.find(v => v.date === day.date)
      
      for (let blockIndex = 0; blockIndex < day.blocks.length; blockIndex++) {
        const block = day.blocks[blockIndex]
        const slotVoters = voteData?.timeSlots?.find(ts => ts.time === block.time)?.voters
        const dayVoters = voteData?.voters || []
        const availableForSlot = slotVoters || dayVoters

        const playerPool: Array<{ id: string; name: string; rosterRole: string; isAvailable: boolean }> = []
        const useAll = day.useAllMembers
        for (const member of teamMembers) {
          const rosterRole = teamRosterRoles.get(member.id) || ''
          const isAvailable = useAll || availableForSlot.some(v => {
            if (v.id === member.id) return true
            const mappedPersonId = discordToPersonId.get(v.id)
            if (mappedPersonId === member.id) return true
            if (v.username === member.username) return true
            return false
          })
          playerPool.push({ id: member.id, name: member.username, rosterRole, isAvailable })
        }

        const newSlots = [...block.slots]
        const assigned = new Set<string>()

        // Preserve existing assignments
        for (const s of newSlots) {
          if (s.playerId) assigned.add(s.playerId)
        }

        // Fill empty slots: role-matched + available first
        for (let i = 0; i < newSlots.length; i++) {
          if (newSlots[i].playerId) continue
          const slot = newSlots[i]
          const match = playerPool.find(p => !assigned.has(p.id) && p.isAvailable && roleMatchesSlot(p.rosterRole, slot.role))
          if (match) {
            newSlots[i] = { ...slot, playerId: match.id }
            assigned.add(match.id)
          }
        }
        for (let i = 0; i < newSlots.length; i++) {
          if (newSlots[i].playerId) continue
          const slot = newSlots[i]
          const fallback = playerPool.find(p => !assigned.has(p.id) && p.isAvailable)
          if (fallback) {
            newSlots[i] = { ...slot, playerId: fallback.id }
            assigned.add(fallback.id)
          }
        }

        const newBlocks = [...newDays[dayIndex].blocks]
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], slots: newSlots }
        newDays[dayIndex] = { ...newDays[dayIndex], blocks: newBlocks }
      }
    }
    updateSchedule({ ...schedule, days: newDays })
    toast.success('Auto-filled all enabled days')
  }

  // Get top N days with best availability
  const getSuggestedDays = (): number[] => {
    if (!votes || votes.length === 0) return []
    return schedule.days
      .map((day, index) => ({
        index,
        count: votes.find(v => v.date === day.date)?.voterCount || 0,
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 days
      .map(d => d.index)
  }

  // Enable only the suggested days
  const enableSuggestedDays = () => {
    const suggested = getSuggestedDays()
    if (suggested.length === 0) return
    
    const newDays = schedule.days.map((day, i) => ({
      ...day,
      enabled: suggested.includes(i),
    }))
    updateSchedule({ ...schedule, days: newDays })
    
    // Auto-expand suggested days and their best block (highest availability)
    setExpandedDays(new Set(suggested))
    const bestBlocks = new Set<string>()
    for (const dayIdx of suggested) {
      const day = schedule.days[dayIdx]
      if (!day || day.blocks.length === 0) continue
      
      // Find block with highest availability
      let bestBlockIdx = 0
      let bestCount = -1
      const voteData = votes?.find(v => v.date === day.date)
      if (voteData?.timeSlots) {
        for (let bi = 0; bi < day.blocks.length; bi++) {
          const slotVoters = voteData.timeSlots.find(ts => ts.time === day.blocks[bi].time)
          const count = slotVoters?.voters.length || 0
          if (count > bestCount) {
            bestCount = count
            bestBlockIdx = bi
          }
        }
      }
      bestBlocks.add(`${dayIdx}-${bestBlockIdx}`)
    }
    setExpandedBlocks(bestBlocks)
  }

  // Enable all days
  const enableAllDays = () => {
    const newDays = schedule.days.map(day => ({ ...day, enabled: true }))
    updateSchedule({ ...schedule, days: newDays })
    setExpandedDays(new Set(schedule.days.map((_, i) => i)))
  }

  // Clear all (disable all days)
  const clearAllDays = () => {
    const newDays = schedule.days.map(day => ({ ...day, enabled: false }))
    updateSchedule({ ...schedule, days: newDays })
    setExpandedDays(new Set())
    setExpandedBlocks(new Set())
  }

  // Get availability status for a specific player in a specific time slot
  const getPlayerSlotAvailability = (dayDate: string, blockTime: string, playerId: string): 'available' | 'maybe' | null => {
    if (!votes || scheduleType !== 'calendar') return null
    const voteData = votes.find(v => v.date === dayDate)
    if (!voteData?.timeSlots) return null
    const slot = voteData.timeSlots.find(ts => ts.time === blockTime)
    if (!slot) return null
    // Match by direct ID or discord→person mapping
    const matchesPlayer = (v: { id: string; username: string }) => {
      if (v.id === playerId) return true
      if (discordToPersonId.get(v.id) === playerId) return true
      return false
    }
    if (slot.voters.some(matchesPlayer)) return 'available'
    // Check maybe status from day-level voters
    const isDayVoter = voteData.voters.some(matchesPlayer)
    return isDayVoter ? 'maybe' : null
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
          <span className="schedule-editor__setup-icon"><Calendar size={24} /></span>
          <h3>Create Your Schedule</h3>
          <p>Add scrim days to build your team's schedule. You can add days individually or generate a full week.</p>
        </div>
        
        <div className="schedule-editor__setup-options">
          {/* Quick setup - generate week */}
          <div className="schedule-editor__setup-card">
            <h4><Calendar size={14} /> Generate Week</h4>
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
                  } else if (startMode === 'thisweek') {
                    // Go back to this Monday
                    const day = startDate.getDay()
                    const delta = day === 0 ? -6 : 1 - day
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
                <option value="thisweek">This Week (from Monday)</option>
              </select>
            </div>
          </div>
          
          {/* Manual - add single day */}
          <div className="schedule-editor__setup-card">
            <h4><CalendarPlus size={14} /> Add Single Day</h4>
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
          <Lightbulb size={14} /> <strong>Tip:</strong> Make sure to select a <strong>Team</strong> and set the <strong>Time Slot</strong> in the sidebar before saving.
        </div>
      </div>
    )
  }

  return (
    <div className="schedule-editor">
      <div className="schedule-editor__header">
        <span className="schedule-editor__header-icon"><Calendar size={18} /></span>
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
            <BarChart3 size={12} /> Scrim Analytics
          </button>
        )}
      </div>

      {/* Analytics Modal */}
      {showAnalytics && team && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="schedule-editor__analytics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__analytics-modal-header">
              <h3><BarChart3 size={12} /> Scrim Analytics</h3>
              <button
                type="button"
                className="schedule-editor__analytics-close"
                onClick={() => setShowAnalytics(false)}
              >
                <X size={14} />
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

      {/* Smart Suggestions Toolbar */}
      {schedule.days.length > 0 && votes && votes.length > 0 && (
        <div className="schedule-editor__toolbar">
          <div className="schedule-editor__toolbar-suggestion">
            <Lightbulb size={13} />
            <span>
              {(() => {
                const suggested = getSuggestedDays()
                if (suggested.length === 0) return 'No availability data yet'
                const dayNames = suggested.map(i => schedule.days[i]?.date.split(' ')[0]).filter(Boolean)
                const bestCount = Math.max(...suggested.map(i => votes?.find(v => v.date === schedule.days[i]?.date)?.voterCount || 0))
                return `Best days: ${dayNames.join(', ')} (${bestCount} available)`
              })()}
            </span>
          </div>
          <div className="schedule-editor__toolbar-actions">
            <button type="button" className="schedule-editor__toolbar-btn schedule-editor__toolbar-btn--suggest" onClick={enableSuggestedDays}>
              <Lightbulb size={12} /> Enable Best
            </button>
            <button type="button" className="schedule-editor__toolbar-btn" onClick={enableAllDays}>
              Enable All
            </button>
            <button type="button" className="schedule-editor__toolbar-btn" onClick={clearAllDays}>
              Clear All
            </button>
            {teamMembers.length > 0 && (
              <button type="button" className="schedule-editor__toolbar-btn schedule-editor__toolbar-btn--autofill" onClick={autoFillAll}>
                ⚡ Auto-Fill All
              </button>
            )}
          </div>
        </div>
      )}

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
          const isExpanded = expandedDays.has(dayIndex)
          
          // Parse day name and date for modern header
          const dateParts = day.date.split(' ')
          const dayName = dateParts[0] || day.date
          const dateRest = dateParts.slice(1).join(' ')

          return (
            <div
              key={day.date}
              className={`schedule-editor__day-card ${!day.enabled ? 'schedule-editor__day-card--disabled' : ''} ${isExpanded ? 'schedule-editor__day-card--expanded' : ''}`}
            >
              <div className="schedule-editor__day-header">
                <label className="schedule-editor__day-toggle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => toggleDay(dayIndex)}
                  />
                </label>
                <button
                  type="button"
                  className="schedule-editor__day-expand"
                  onClick={() => setExpandedDays(prev => {
                    const next = new Set(prev)
                    if (next.has(dayIndex)) next.delete(dayIndex)
                    else next.add(dayIndex)
                    return next
                  })}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="schedule-editor__day-name-group">
                    <span className="schedule-editor__day-title">{dayName}</span>
                    {dateRest && <span className="schedule-editor__day-date">{dateRest}</span>}
                  </div>
                </button>
                {voteData && (
                  <span className="schedule-editor__day-voters">
                    {voteData.voterCount} available
                  </span>
                )}
                {/* Collapsed summary: show block count */}
                {!isExpanded && day.enabled && day.blocks.length > 0 && (
                  <span className="schedule-editor__day-summary">
                    {day.blocks.length} block{day.blocks.length !== 1 ? 's' : ''}
                  </span>
                )}
                {day.enabled && isExpanded && (
                  <label className="schedule-editor__use-all-toggle">
                    <input
                      type="checkbox"
                      checked={day.useAllMembers || false}
                      onChange={() => toggleUseAllMembers(dayIndex)}
                    />
                    <span>All members</span>
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
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {day.enabled && isExpanded && (
                <div className="schedule-editor__day-content">
                  {day.blocks.map((block, blockIndex) => {
                    const assignedIds = getAssignedPlayerIds(dayIndex, blockIndex)
                    const blockKey = `${dayIndex}-${blockIndex}`
                    const isBlockExpanded = expandedBlocks.has(blockKey)
                    const filledCount = block.slots.filter(s => s.playerId || s.isRinger).length
                    
                    return (
                      <div key={block.id} className={`schedule-editor__block ${isBlockExpanded ? 'schedule-editor__block--expanded' : ''}`}>
                        <div className="schedule-editor__block-header">
                          <button
                            type="button"
                            className="schedule-editor__block-toggle"
                            onClick={() => setExpandedBlocks(prev => {
                              const next = new Set(prev)
                              if (next.has(blockKey)) next.delete(blockKey)
                              else next.add(blockKey)
                              return next
                            })}
                          >
                            {isBlockExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <input
                            type="text"
                            className="schedule-editor__block-time"
                            value={block.time}
                            onChange={(e) => updateBlockTime(dayIndex, blockIndex, e.target.value)}
                            placeholder="8-10 EST"
                          />
                          {!isBlockExpanded && (
                            <span className="schedule-editor__block-summary">
                              {filledCount > 0 ? `${filledCount}/${block.slots.length} filled` : `${block.slots.length} slots`}
                              {(() => {
                                const slotVoters = voteData?.timeSlots?.find(ts => ts.time === block.time)
                                if (slotVoters) return ` · ${slotVoters.voters.length} avail`
                                return ''
                              })()}
                            </span>
                          )}
                          {!isBlockExpanded && teamMembers.length > 0 && (
                            <button
                              type="button"
                              className="schedule-editor__block-autofill"
                              onClick={(e) => { e.stopPropagation(); autoFillBlock(dayIndex, blockIndex) }}
                              title="Auto-fill this block with available players"
                            >
                              ⚡
                            </button>
                          )}
                          {day.blocks.length > 1 && (
                            <button
                              type="button"
                              className="schedule-editor__block-remove"
                              onClick={() => removeBlock(dayIndex, blockIndex)}
                              title="Remove this time block"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {isBlockExpanded && (
                        <>
                        <div className="schedule-editor__roles">
                          {block.slots.map((slot, slotIndex) => {
                            const filteredPlayers = availablePlayers.filter(
                              (p) => !assignedIds.has(p.id) || p.id === slot.playerId,
                            )

                            return (
                              <div key={slotIndex} className={`schedule-editor__role-row ${slot.isRinger ? 'schedule-editor__role-row--ringer' : ''}`} data-role={slot.role.toLowerCase()}>
                                <input
                                  type="text"
                                  className="schedule-editor__role-input"
                                  value={slot.role}
                                  onChange={(e) => updateSlotRole(dayIndex, blockIndex, slotIndex, e.target.value)}
                                  placeholder="Role..."
                                />
                                
                                {/* Ringer checkbox */}
                                <label className="schedule-editor__ringer-toggle" title="Mark as external player">
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
                                    <option value="">- Select -</option>
                                    {filteredPlayers.map((player) => {
                                      const avail = getPlayerSlotAvailability(day.date, block.time, player.id)
                                      const prefix = avail === 'available' ? '✓ ' : avail === 'maybe' ? '? ' : ''
                                      return (
                                        <option key={player.id} value={player.id}>
                                          {prefix}{player.displayName || player.username}
                                        </option>
                                      )
                                    })}
                                  </select>
                                )}
                                
                                {slotIndex >= roles.length && (
                                  <button
                                    type="button"
                                    className="schedule-editor__remove-btn"
                                    onClick={() => removeSlot(dayIndex, blockIndex, slotIndex)}
                                    title="Remove slot"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            )
                          })}

                          <div className="schedule-editor__block-actions">
                            <button
                              type="button"
                              className="schedule-editor__add-btn"
                              onClick={() => addExtraPlayer(dayIndex, blockIndex)}
                            >
                              + Add Player
                            </button>
                            {teamMembers.length > 0 && (
                              <button
                                type="button"
                                className="schedule-editor__autofill-btn"
                                onClick={() => autoFillBlock(dayIndex, blockIndex)}
                              >
                                ⚡ Auto-Fill
                              </button>
                            )}
                          </div>
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
                                <option value="">- Select -</option>
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
                        </>
                        )}
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    className="schedule-editor__add-block-btn"
                    onClick={() => addBlock(dayIndex)}
                  >
                    <Plus size={12} /> Add Time Block
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
