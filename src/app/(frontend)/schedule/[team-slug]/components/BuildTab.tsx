'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Wrench, Lightbulb, RefreshCw, Save, Send, Loader2, CheckCircle, AlertTriangle, X, Bell, ClipboardList, Plus } from 'lucide-react'
import { useSchedule } from '@/components/scheduling/ScheduleContext'
import { suggestLineup } from '@/components/scheduling/AutoLineup'
import type { RosterEntry } from '@/components/scheduling/types'
import { ACTIVITY_TYPES, OPPONENT_ACTIVITIES, getBlockActivity } from '@/components/ScheduleEditor/types'
import './BuildTab.css'

interface PlayerSlot {
  role: string
  playerId: string | null
  playerIds?: string[]
  isRinger?: boolean
  ringerName?: string
  isTrial?: boolean
}

function getSlotPlayerIds(slot: PlayerSlot): string[] {
  if (slot.playerIds?.length) return slot.playerIds
  if (slot.playerId) return [slot.playerId]
  return []
}

interface BlockOutcome {
  ourRating?: 'easywin' | 'closewin' | 'neutral' | 'closeloss' | 'gotrolled'
  opponentRating?: 'weak' | 'average' | 'strong' | 'verystrong'
  worthScrimAgain?: 'yes' | 'maybe' | 'no'
  scrimNotes?: string
}

interface TimeBlock {
  id: string
  time: string
  startTime?: string
  activity?: string
  slots: PlayerSlot[]
  scrim?: {
    isScrim?: boolean
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
  outcome?: BlockOutcome
}

interface DaySchedule {
  date: string
  isoDate?: string
  enabled: boolean
  blocks: TimeBlock[]
}

const ROLE_FAMILY: Record<string, string[]> = {
  tank: ['tank'],
  dps: ['dps', 'hitscan', 'flex dps'],
  support: ['support', 'main support', 'flex support'],
}

function roleMatchesFamily(playerRole: string, slotRole: string): boolean {
  if (playerRole === slotRole) return true
  const pr = playerRole.toLowerCase()
  const sr = slotRole.toLowerCase()
  if (pr === sr) return true
  for (const family of Object.values(ROLE_FAMILY)) {
    if (family.includes(pr) && family.includes(sr)) return true
  }
  return false
}

interface RoleOption {
  label: string
  abbrev: string
  color: string
}

const SPECIFIC_ROLES: RoleOption[] = [
  { label: 'Tank', abbrev: 'T', color: '#00e5ff' },
  { label: 'Hitscan', abbrev: 'HS', color: '#ff3e8a' },
  { label: 'Flex DPS', abbrev: 'FDPS', color: '#ff9f1c' },
  { label: 'Main Support', abbrev: 'MS', color: '#00ff9f' },
  { label: 'Flex Support', abbrev: 'FS', color: '#b44dff' },
  { label: 'Coach', abbrev: 'Coach', color: '#94a3b8' },
]

const GENERIC_ROLES: RoleOption[] = [
  { label: 'Tank', abbrev: 'T', color: '#00e5ff' },
  { label: 'DPS', abbrev: 'DPS', color: '#ff3e8a' },
  { label: 'Support', abbrev: 'SUP', color: '#00ff9f' },
  { label: 'Coach', abbrev: 'Coach', color: '#94a3b8' },
]

const CUSTOM_COLORS = ['#00e5ff', '#ff3e8a', '#ff9f1c', '#00ff9f', '#b44dff', '#f59e0b', '#ec4899', '#06b6d4']

const ROLE_PRESETS: Record<string, string[]> = {
  specific: ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
  generic: ['Tank', 'DPS', 'Support'],
}

function getRoleOptions(team: any): RoleOption[] {
  const preset = team.rolePreset || 'specific'
  if (preset === 'generic') return GENERIC_ROLES
  if (preset === 'custom' && team.customRoles) {
    return team.customRoles.split(',').map((r: string, i: number) => {
      const label = r.trim()
      const abbrev = label.length <= 4 ? label.toUpperCase() : label.slice(0, 3).toUpperCase()
      return { label, abbrev, color: CUSTOM_COLORS[i % CUSTOM_COLORS.length] }
    }).filter((r: RoleOption) => r.label)
  }
  return SPECIFIC_ROLES
}

function getRoleColor(roleName: string, roleOptions: RoleOption[]): string {
  const match = roleOptions.find(r => r.label === roleName)
  return match?.color || '#94a3b8'
}

interface ColumnDef {
  dayIdx: number
  blockIdx: number
  date: string
  time: string
  isFirstOfDay: boolean
}

interface DropdownState {
  dayIdx: number
  blockIdx: number
  slotIdx: number
  rowType: 'role' | 'activity' | 'opponent'
  rect?: { top: number; left: number; width: number; height: number }
}

export function BuildTab() {
  const { data, refreshData, viewedCalendar } = useSchedule()
  const { team } = data

  const [days, setDays] = useState<DaySchedule[]>([])
  const [opponentTeams, setOpponentTeams] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragData, setDragData] = useState<{ dayIdx: number; blockIdx: number; slotIdx: number; playerId: string } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<DropdownState | null>(null)
  const [scrimModal, setScrimModal] = useState<{ dayIdx: number; blockIdx: number } | null>(null)
  const [opponentPickerOpen, setOpponentPickerOpen] = useState(false)
  const [ringerInput, setRingerInput] = useState<string | null>(null)
  const [outcomeModal, setOutcomeModal] = useState<{ dayIdx: number; blockIdx: number } | null>(null)
  const [editingRinger, setEditingRinger] = useState<{ dayIdx: number; blockIdx: number; slotIdx: number } | null>(null)
  const [editingRingerName, setEditingRingerName] = useState('')
  const [addBlockMenu, setAddBlockMenu] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const ringerInputRef = useRef<HTMLInputElement>(null)
  const ringerEditRef = useRef<HTMLInputElement>(null)

  const roleOptions = useMemo(() => getRoleOptions(team), [team.rolePreset, team.customRoles])

  const roles = useMemo(() => {
    let preset = team.rolePreset || 'specific'
    if (preset === 'custom' && team.customRoles) {
      return team.customRoles.split(',').map((r: string) => r.trim()).filter(Boolean)
    }
    if (preset === 'specific') preset = 'specific'
    return ROLE_PRESETS[preset] || ROLE_PRESETS.specific
  }, [team.rolePreset, team.customRoles])

  const responses = viewedCalendar?.responses || []

  const playerMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of [...team.roster, ...team.subs]) {
      if (entry.person) {
        map[String(entry.person.id)] = entry.person.name || 'Unknown'
        if (entry.person.discordId) {
          map[entry.person.discordId] = entry.person.name || 'Unknown'
        }
      }
    }
    for (const r of responses) {
      if (r.discordId && r.discordUsername && !map[r.discordId]) {
        map[r.discordId] = r.discordUsername
      }
    }
    return map
  }, [team.roster, team.subs, responses])

  const rosterPlayers = useMemo(() => {
    return [...team.roster, ...team.subs]
      .filter((e: any) => e.person)
      .map((e: any) => ({
        id: String(e.person.id),
        name: e.person.name || 'Unknown',
        discordId: e.person.discordId || '',
        role: e.role,
        isSub: team.subs.some((s: any) => s.person?.id === e.person.id),
      }))
  }, [team.roster, team.subs])

  const respondedDiscordIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of responses) {
      if (r.discordId) ids.add(r.discordId)
    }
    return ids
  }, [responses])

  const discordToPersonId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of rosterPlayers) {
      if (p.discordId) map[p.discordId] = p.id
    }
    return map
  }, [rosterPlayers])

  const ROSTER_ROLE_MAP: Record<string, string> = { tank: 'Tank', dps: 'DPS', support: 'Support' }

  const playerStatusMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of responses) {
      if (!r.discordId) continue
      const personId = discordToPersonId[r.discordId]
      const player = rosterPlayers.find(p => p.discordId === r.discordId)
      const defaultStatus = player?.isSub ? 'sub' : 'main'
      const id = personId || r.discordId
      map[id] = r.scheduleStatus || defaultStatus
    }
    return map
  }, [responses, discordToPersonId, rosterPlayers])

  const availabilityMap = useMemo(() => {
    const map: Record<string, { name: string; personId: string; status: string; role: string; scheduleStatus: string }[]> = {}
    for (const r of responses) {
      if (!r.selections) continue
      const personId = discordToPersonId[r.discordId]
      const player = rosterPlayers.find(p => p.discordId === r.discordId)
      const name = player?.name || r.discordUsername || 'Unknown'
      const role = r.scheduleRole || (player ? ROSTER_ROLE_MAP[player.role] : '') || ''
      const defaultStatus = player?.isSub ? 'sub' : 'main'
      const scheduleStatus = r.scheduleStatus || defaultStatus
      for (const [dateKey, slots] of Object.entries(r.selections)) {
        for (const [slotTime, status] of Object.entries(slots as Record<string, string>)) {
          if (status === 'available' || status === 'maybe') {
            const key = `${dateKey}|${slotTime}`
            if (!map[key]) map[key] = []
            map[key].push({ name, personId: personId || r.discordId, status, role, scheduleStatus })
          }
        }
      }
    }
    return map
  }, [responses, discordToPersonId, rosterPlayers])

  const trialRoles = useMemo(() => {
    const rolesWithTrials = new Set<string>()
    for (const entries of Object.values(availabilityMap)) {
      for (const e of entries) {
        if (e.scheduleStatus === 'tryout') rolesWithTrials.add(e.role)
      }
    }
    return rolesWithTrials
  }, [availabilityMap])

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>()
    for (const day of days) {
      for (const block of day.blocks) {
        for (const slot of block.slots) {
          for (const pid of getSlotPlayerIds(slot)) ids.add(pid)
        }
      }
    }
    return ids
  }, [days])

  const respondedPlayers = useMemo(() =>
    rosterPlayers.filter(p => respondedDiscordIds.has(p.discordId)),
    [rosterPlayers, respondedDiscordIds]
  )

  const unassignedPlayers = useMemo(() =>
    respondedPlayers.filter(p => !assignedPlayerIds.has(p.id)),
    [respondedPlayers, assignedPlayerIds]
  )

  const columns: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = []
    days.forEach((day, dayIdx) => {
      if (!day.enabled) return
      day.blocks.forEach((block, blockIdx) => {
        cols.push({
          dayIdx,
          blockIdx,
          date: day.date,
          time: block.time,
          isFirstOfDay: blockIdx === 0,
        })
      })
    })
    return cols
  }, [days])

  const dayGroups = useMemo(() => {
    const groups: { date: string; dayIdx: number; colSpan: number }[] = []
    let lastDate = ''
    for (const col of columns) {
      if (col.date !== lastDate) {
        groups.push({ date: col.date, dayIdx: col.dayIdx, colSpan: 1 })
        lastDate = col.date
      } else {
        groups[groups.length - 1].colSpan++
      }
    }
    return groups
  }, [columns])

  const getSlotReadiness = useCallback((dayIdx: number, blockIdx: number): 'green' | 'yellow' | 'red' | 'none' => {
    const day = days[dayIdx]
    const block = day?.blocks[blockIdx]
    if (!day?.isoDate || !block) return 'none'
    const availKey = `${day.isoDate}|${block.startTime || block.time}`
    const avail = availabilityMap[availKey] || []
    const mainAvail = avail.filter(a => a.scheduleStatus === 'main')
    const coreRoles = roles.filter(r => r !== 'Coach' && r !== 'Sub')
    if (coreRoles.length === 0) return 'none'
    const slotsNeeded: Record<string, number> = {}
    for (const role of coreRoles) slotsNeeded[role] = (slotsNeeded[role] || 0) + 1
    let covered = 0
    for (const [role, needed] of Object.entries(slotsNeeded)) {
      const uniquePlayers = new Set(mainAvail.filter(a => roleMatchesFamily(a.role, role)).map(a => a.personId))
      covered += Math.min(uniquePlayers.size, needed)
    }
    if (covered >= coreRoles.length) return 'green'
    if (covered >= coreRoles.length - 1) return 'yellow'
    return 'red'
  }, [days, availabilityMap, roles])

  const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const createDefaultBlock = useCallback((time: string, startTime?: string): TimeBlock => ({
    id: generateBlockId(),
    time,
    startTime,
    slots: roles.map(role => ({ role, playerId: null })),
    scrim: {
      opponentTeamId: null,
      opponent: '',
      opponentRoster: '',
      contact: '',
      host: '',
      mapPool: '',
      heroBans: true,
      staggers: false,
      notes: '',
    },
  }), [roles])

  useEffect(() => {
    if (!viewedCalendar) return

    const parseDate = (s: string) => {
      const [y, m, d] = s.split('T')[0].split('-').map(Number)
      return new Date(y, m - 1, d, 12, 0, 0)
    }

    const formatDayLabel = (d: Date) => {
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${dayName} ${dateLabel}`
    }

    if (viewedCalendar.schedule?.days?.length) {
      const fixed = viewedCalendar.schedule.days.map((day: DaySchedule) => {
        if (!day.isoDate) return day
        const d = parseDate(day.isoDate)
        return { ...day, date: formatDayLabel(d) }
      })
      const hasAssignments = fixed.some((day: DaySchedule) =>
        day.blocks?.some(block => block.slots?.some(slot => slot.playerId))
      )
      if (hasAssignments) {
        setDays(fixed)
        return
      }
    }

    const { dateRange, timeSlots } = viewedCalendar
    if (!dateRange?.start || !dateRange?.end) return

    const start = parseDate(dateRange.start)
    const end = parseDate(dateRange.end)
    const newDays: DaySchedule[] = []
    const current = new Date(start)

    while (current <= end) {
      const isoDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      const effectiveSlots = timeSlots?.length ? timeSlots : (team.scheduleBlocks || [])
      const blocks = effectiveSlots.map((slot: any) =>
        createDefaultBlock(slot.label || slot.startTime || '8-10', slot.startTime)
      )
      newDays.push({ date: formatDayLabel(current), isoDate, enabled: true, blocks })
      current.setDate(current.getDate() + 1)
    }

    if (viewedCalendar.responses?.length) {
      setDays(suggestLineup(newDays, team.roster as RosterEntry[], team.subs as RosterEntry[], viewedCalendar.responses))
    } else {
      setDays(newDays)
    }
  }, [viewedCalendar, team.scheduleBlocks, createDefaultBlock, team.roster, team.subs])

  useEffect(() => {
    if (trialRoles.size === 0 || days.length === 0) return
    let needsUpdate = false
    const updated = days.map(day => ({
      ...day,
      blocks: day.blocks.map(block => {
        const missingTrialSlots: PlayerSlot[] = []
        for (const role of trialRoles) {
          if (!block.slots.some(s => s.role === role && s.isTrial)) {
            missingTrialSlots.push({ role, playerId: null, isTrial: true })
          }
        }
        if (missingTrialSlots.length === 0) return block
        needsUpdate = true
        const mainSlots: PlayerSlot[] = []
        for (const s of block.slots) {
          mainSlots.push(s)
          if (!s.isTrial) {
            const trialForRole = missingTrialSlots.filter(ts => ts.role === s.role)
            mainSlots.push(...trialForRole)
            trialForRole.forEach(ts => missingTrialSlots.splice(missingTrialSlots.indexOf(ts), 1))
          }
        }
        mainSlots.push(...missingTrialSlots)
        return { ...block, slots: mainSlots }
      }),
    }))
    if (needsUpdate) setDays(updated)
  }, [trialRoles, days.length])

  useEffect(() => {
    fetch('/api/opponent-teams?limit=100&sort=name')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.docs) setOpponentTeams(data.docs) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
        setRingerInput(null)
      }
    }
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdown])

  const updateSlot = (dayIdx: number, blockIdx: number, slotIdx: number, playerId: string | null) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            slots: block.slots.map((slot, si) => si === slotIdx ? { ...slot, playerId, playerIds: playerId ? [playerId] : [], isRinger: false, ringerName: '' } : slot),
          }
        }),
      }
    }))
    setSaved(false)
    setRingerInput(null)
    setOpenDropdown(null)
  }

  const toggleSlotPlayer = (dayIdx: number, blockIdx: number, slotIdx: number, playerId: string) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            slots: block.slots.map((slot, si) => {
              if (si !== slotIdx) return slot
              const current = getSlotPlayerIds(slot)
              const newIds = current.includes(playerId)
                ? current.filter(id => id !== playerId)
                : [...current, playerId]
              return { ...slot, playerIds: newIds, playerId: newIds[0] || null }
            }),
          }
        }),
      }
    }))
    setSaved(false)
  }

  const createSlotAndToggle = (dayIdx: number, blockIdx: number, role: string, isTrial: boolean, playerId: string) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          const existingIdx = block.slots.findIndex(s => s.role === role && !!s.isTrial === isTrial)
          if (existingIdx >= 0) {
            const slot = block.slots[existingIdx]
            const current = getSlotPlayerIds(slot)
            const newIds = current.includes(playerId) ? current.filter(id => id !== playerId) : [...current, playerId]
            return {
              ...block,
              slots: block.slots.map((s, si) => si === existingIdx ? { ...s, playerIds: newIds, playerId: newIds[0] || null } : s),
            }
          }
          return {
            ...block,
            slots: [...block.slots, { role, playerId, playerIds: [playerId], isTrial }],
          }
        }),
      }
    }))
    setSaved(false)
  }

  const setSlotRinger = (dayIdx: number, blockIdx: number, slotIdx: number, name: string) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            slots: block.slots.map((slot, si) => si === slotIdx ? { ...slot, playerId: null, isRinger: true, ringerName: name } : slot),
          }
        }),
      }
    }))
    setSaved(false)
    setRingerInput(null)
    setOpenDropdown(null)
  }

  const updateRingerName = (dayIdx: number, blockIdx: number, slotIdx: number, name: string) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            slots: block.slots.map((slot, si) => si === slotIdx ? { ...slot, ringerName: name || 'Ringer Needed' } : slot),
          }
        }),
      }
    }))
    setSaved(false)
    setEditingRinger(null)
  }

  const removeRinger = (dayIdx: number, blockIdx: number, slotIdx: number) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            slots: block.slots.map((slot, si) => si === slotIdx ? { ...slot, isRinger: false, ringerName: '' } : slot),
          }
        }),
      }
    }))
    setSaved(false)
  }

  const updateScrimOpponent = (dayIdx: number, blockIdx: number, opponentId: number | null) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          const opponent = opponentTeams.find(t => t.id === opponentId)
          return {
            ...block,
            scrim: {
              ...(block.scrim || { opponent: '', opponentRoster: '', contact: '', host: '' as const, mapPool: '', heroBans: true, staggers: false, notes: '' }),
              isScrim: true,
              opponentTeamId: opponentId,
              opponent: opponent?.name || '',
            },
          }
        }),
      }
    }))
    setSaved(false)
    setOpenDropdown(null)
  }

  const updateScrimDetails = (dayIdx: number, blockIdx: number, scrimData: Partial<TimeBlock['scrim']>) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            scrim: {
              ...(block.scrim || { opponent: '', opponentRoster: '', contact: '', host: '' as const, mapPool: '', heroBans: true, staggers: false, notes: '' }),
              ...scrimData,
            },
          }
        }),
      }
    }))
    setSaved(false)
  }

  const updateOutcome = (dayIdx: number, blockIdx: number, data: Partial<BlockOutcome>) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return { ...block, outcome: { ...(block.outcome || {}), ...data } }
        }),
      }
    }))
    setSaved(false)
  }

  const updateActivity = (dayIdx: number, blockIdx: number, activity: string) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          const needsOpponent = OPPONENT_ACTIVITIES.has(activity)
          return {
            ...block,
            activity,
            scrim: {
              ...(block.scrim || { opponent: '', opponentRoster: '', contact: '', host: '' as const, mapPool: '', heroBans: true, staggers: false, notes: '' }),
              isScrim: needsOpponent,
              ...(needsOpponent ? {} : { opponentTeamId: null, opponent: '' }),
            },
          }
        }),
      }
    }))
    setSaved(false)
    setOpenDropdown(null)
  }

  const updateBlockTime = (dayIdx: number, blockIdx: number, time: string) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => bi === blockIdx ? { ...block, time } : block),
      }
    }))
    setSaved(false)
  }

  const addBlock = (dayIdx: number, position: 'start' | 'end' = 'end') => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      const newBlock = createDefaultBlock('')
      return {
        ...day,
        blocks: position === 'start' ? [newBlock, ...day.blocks] : [...day.blocks, newBlock],
      }
    }))
    setSaved(false)
  }

  const removeBlock = (dayIdx: number, blockIdx: number) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      if (day.blocks.length <= 1) return day
      return { ...day, blocks: day.blocks.filter((_, bi) => bi !== blockIdx) }
    }))
    setSaved(false)
  }

  const handleDragStart = (e: React.DragEvent, dayIdx: number, blockIdx: number, slotIdx: number, playerId: string) => {
    setDragData({ dayIdx, blockIdx, slotIdx, playerId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handlePoolDragStart = (e: React.DragEvent, playerId: string) => {
    setDragData({ dayIdx: -1, blockIdx: -1, slotIdx: -1, playerId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCell(cellKey)
  }

  const handleDragLeave = () => {
    setDragOverCell(null)
  }

  const handleDrop = (e: React.DragEvent, targetDayIdx: number, targetBlockIdx: number, targetSlotIdx: number) => {
    e.preventDefault()
    setDragOverCell(null)
    if (!dragData) return

    const { dayIdx: srcDay, blockIdx: srcBlock, slotIdx: srcSlot, playerId } = dragData

    setDays(prev => {
      const next = prev.map(d => ({ ...d, blocks: d.blocks.map(b => ({ ...b, slots: [...b.slots] })) }))

      const targetSlot = next[targetDayIdx].blocks[targetBlockIdx].slots[targetSlotIdx]
      const existingPlayerId = targetSlot.playerId

      next[targetDayIdx].blocks[targetBlockIdx].slots[targetSlotIdx] = { ...targetSlot, playerId }

      if (srcDay >= 0) {
        next[srcDay].blocks[srcBlock].slots[srcSlot] = {
          ...next[srcDay].blocks[srcBlock].slots[srcSlot],
          playerId: existingPlayerId,
        }
      }

      return next
    })

    setDragData(null)
    setSaved(false)
  }

  const handleDragEnd = () => {
    setDragData(null)
    setDragOverCell(null)
  }

  const runSuggest = useCallback((currentDays: DaySchedule[]) => {
    if (!viewedCalendar?.responses) return currentDays
    return suggestLineup(
      currentDays,
      team.roster as RosterEntry[],
      team.subs as RosterEntry[],
      viewedCalendar.responses,
    )
  }, [viewedCalendar, team.roster, team.subs])

  const handleSuggest = () => {
    const suggested = runSuggest(days)
    setDays(suggested)
    setSaved(false)
  }

  const handleRecalculate = () => {
    const cleared = days.map(day => ({
      ...day,
      blocks: day.blocks.map(block => ({
        ...block,
        slots: block.slots.map(slot => ({ ...slot, playerId: null, playerIds: [] })),
      })),
    }))
    setDays(runSuggest(cleared))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!viewedCalendar) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/${team.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveSchedule',
          calendarId: viewedCalendar.id,
          schedule: { days, lastUpdated: new Date().toISOString() },
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to save schedule')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!viewedCalendar) return
    setPublishing(true)
    setError(null)
    try {
      const { publishScheduleAction } = await import('@/actions/publish-schedule')
      const result = await publishScheduleAction(Number(viewedCalendar.id))
      if (result?.error) throw new Error(result.error)
      setPublished(true)
      setTimeout(() => setPublished(false), 3000)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  const [reminderSending, setReminderSending] = useState<string | null>(null)
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set())

  const handleSendReminder = async (dayDate: string, blockTime: string) => {
    if (!viewedCalendar) return
    const key = `${dayDate}|${blockTime}`
    setReminderSending(key)
    setError(null)
    try {
      const { postScrimReminderAction } = await import('@/actions/post-scrim-reminder')
      const result = await postScrimReminderAction(Number(viewedCalendar.id), dayDate, blockTime)
      if (result?.error) throw new Error(result.error)
      setReminderSent(prev => new Set(prev).add(key))
    } catch (err: any) {
      setError(err.message || 'Failed to send reminder')
    } finally {
      setReminderSending(null)
    }
  }

  const getDayLabel = (dateStr: string) => {
    const parts = dateStr.split(' ')
    return parts[0] || dateStr
  }

  const getDateLabel = (dateStr: string) => {
    const parts = dateStr.split(' ')
    return parts.slice(1).join(' ') || ''
  }

  if (!viewedCalendar) {
    return (
      <div className="build-tab build-tab--empty">
        <Wrench size={32} />
        <p>No active calendar to build a schedule for.</p>
      </div>
    )
  }

  const hasChanges = viewedCalendar.availabilityChangedAfterSchedule

  const rowDefs = useMemo(() => {
    const defs: { role: string; isTrial: boolean; occurrence: number }[] = []
    const occCounts: Record<string, number> = {}
    for (const role of roles) {
      const occ = occCounts[role] || 0
      occCounts[role] = occ + 1
      defs.push({ role, isTrial: false, occurrence: occ })
      if (trialRoles.has(role)) {
        defs.push({ role, isTrial: true, occurrence: occ })
      }
    }
    defs.push({ role: 'Sub', isTrial: false, occurrence: 0 })
    return defs
  }, [roles, trialRoles])
  return (
    <div className="build-tab">
      <div className="build-tab__header">
        <div className="build-tab__header-left">
          <Wrench size={20} />
          <h3 className="build-tab__title">Lineup Builder</h3>
          {hasChanges && (
            <span className="build-tab__changes-badge">
              <AlertTriangle size={14} />
              Availability changed since last build
            </span>
          )}
        </div>
        <div className="build-tab__header-actions">
          <button className="build-tab__suggest-btn" onClick={handleSuggest}>
            <Lightbulb size={14} /> Suggest
          </button>
          <button className="build-tab__recalc-btn" onClick={handleRecalculate}>
            <RefreshCw size={14} /> Recalculate
          </button>
          <button className="build-tab__save-btn" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="build-tab__spinner" /> Saving...</> :
             saved ? <><CheckCircle size={14} /> Saved!</> :
             <><Save size={14} /> Save</>}
          </button>
          <button className="build-tab__publish-btn" onClick={handlePublish} disabled={publishing || saving}>
            {publishing ? <><Loader2 size={14} className="build-tab__spinner" /> Publishing...</> :
             published ? <><CheckCircle size={14} /> Published!</> :
             <><Send size={14} /> Post to Discord</>}
          </button>
        </div>
      </div>

      {error && <div className="build-tab__error">{error}</div>}

      <div className="build-tab__legend">
        <span className="build-tab__legend-item"><span className="build-tab__legend-swatch build-tab__legend-swatch--available" />Selected</span>
        <span className="build-tab__legend-item"><span className="build-tab__legend-swatch build-tab__legend-swatch--maybe" />Maybe</span>
        <span className="build-tab__legend-item"><span className="build-tab__legend-swatch build-tab__legend-swatch--unassigned" />Unselected</span>
        <span className="build-tab__legend-item"><span className="build-tab__legend-swatch build-tab__legend-swatch--ringer" />Ringer</span>
      </div>

      {unassignedPlayers.length > 0 && (
        <div className="build-tab__pool">
          <span className="build-tab__pool-label">Bench</span>
          {unassignedPlayers.map(p => (
            <div
              key={p.id}
              className="build-tab__pool-chip"
              draggable
              onDragStart={e => handlePoolDragStart(e, p.id)}
              onDragEnd={handleDragEnd}
            >
              {p.name}{p.isSub ? ' (S)' : ''}
            </div>
          ))}
        </div>
      )}

      <div className="build-tab__grid-wrapper">
        <table className="build-tab__grid">
          <thead>
            <tr className="build-tab__day-row">
              <th className="build-tab__role-header" rowSpan={2}></th>
              {dayGroups.map((group, i) => (
                <th
                  key={i}
                  className={`build-tab__day-header ${i > 0 ? 'build-tab__day-header--divider' : ''}`}
                  colSpan={group.colSpan}
                >
                  <span className="build-tab__day-name">{getDayLabel(group.date)}</span>
                  <span className="build-tab__day-date">{getDateLabel(group.date)}</span>
                  <div className="build-tab__add-block-wrap">
                    <button className="build-tab__add-block-btn" onClick={(e) => { e.stopPropagation(); setAddBlockMenu(prev => prev === group.dayIdx ? null : group.dayIdx) }} title="Add time block">
                      <Plus size={12} />
                    </button>
                    {addBlockMenu === group.dayIdx && (
                      <>
                        <div className="build-tab__add-block-backdrop" onClick={() => setAddBlockMenu(null)} />
                        <div className="build-tab__add-block-menu">
                          <button onClick={() => { addBlock(group.dayIdx, 'start'); setAddBlockMenu(null) }}>Add before</button>
                          <button onClick={() => { addBlock(group.dayIdx, 'end'); setAddBlockMenu(null) }}>Add after</button>
                        </div>
                      </>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="build-tab__time-row">
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  className={`build-tab__time-header ${col.isFirstOfDay && ci > 0 ? 'build-tab__time-header--day-start' : ''}`}
                >
                  <div className="build-tab__time-header-inner">
                    {(() => {
                      const readiness = getSlotReadiness(col.dayIdx, col.blockIdx)
                      return readiness !== 'none' ? (
                        <span className={`build-tab__readiness-dot build-tab__readiness-dot--${readiness}`} title={readiness === 'green' ? 'All roles covered' : readiness === 'yellow' ? 'Almost full' : 'Roles missing'} />
                      ) : null
                    })()}
                    <input
                      type="text"
                      className="build-tab__time-input"
                      value={col.time}
                      onChange={e => updateBlockTime(col.dayIdx, col.blockIdx, e.target.value)}
                      placeholder="e.g. 8-10"
                    />
                    {days[col.dayIdx].blocks.length > 1 && (
                      <button className="build-tab__remove-block-btn" onClick={() => removeBlock(col.dayIdx, col.blockIdx)} title="Remove block">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowDefs.map((rowDef, roleIdx) => {
              const { role: roleName, isTrial, occurrence } = rowDef
              const color = isTrial ? '#fbbf24' : getRoleColor(roleName, roleOptions)
              const isSub = roleName === 'Sub'

              return (
                <tr key={`${roleName}-${isTrial}-${occurrence}`} className={`build-tab__role-row ${isTrial ? 'build-tab__role-row--trial' : ''}`}>
                  <td className="build-tab__role-label" style={{ borderLeftColor: color }}>
                    <span className="build-tab__role-label-text" style={{ color }}>
                      {roleName}
                    </span>
                    {isTrial && <span className="build-tab__trial-badge">Trial</span>}
                  </td>
                  {columns.map((col, ci) => {
                    const block = days[col.dayIdx]?.blocks[col.blockIdx]
                    if (!block) return <td key={ci} className="build-tab__cell build-tab__cell--empty" />

                    let slot: PlayerSlot | undefined
                    let slotIdx = -1

                    if (isTrial) {
                      let count = 0
                      slotIdx = block.slots.findIndex(s => {
                        if (s.role === roleName && s.isTrial) {
                          if (count === occurrence) return true
                          count++
                        }
                        return false
                      })
                      slot = slotIdx >= 0 ? block.slots[slotIdx] : undefined
                    } else if (isSub) {
                      slotIdx = block.slots.findIndex(s => s.role === 'Sub' && !s.isTrial)
                      slot = slotIdx >= 0 ? block.slots[slotIdx] : undefined
                    } else {
                      let count = 0
                      slotIdx = block.slots.findIndex(s => {
                        if (s.role === roleName && !s.isTrial) {
                          if (count === occurrence) return true
                          count++
                        }
                        return false
                      })
                      slot = slotIdx >= 0 ? block.slots[slotIdx] : undefined
                    }

                    if (!slot || slotIdx < 0) {
                      if (isTrial || isSub) {
                        return (
                          <td key={ci} className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}>
                            {(() => {
                              const day = days[col.dayIdx]
                              const availKey = `${day.isoDate}|${block.startTime || block.time}`
                              const allAvail = availabilityMap[availKey] || []
                              const forRole = isTrial
                                ? allAvail.filter(a => roleMatchesFamily(a.role, roleName) && a.scheduleStatus === 'tryout')
                                : allAvail.filter(a => a.scheduleStatus === 'sub')
                              return forRole.length > 0 ? (
                                <div className="build-tab__cell-avail-players">
                                  {forRole.map(a => (
                                    <span
                                      key={a.personId}
                                      className={`build-tab__avail-chip build-tab__avail-chip--clickable ${isTrial ? 'build-tab__avail-chip--trial' : ''} ${a.status === 'maybe' ? 'build-tab__avail-chip--maybe' : ''}`}
                                      style={{ borderColor: color }}
                                      onClick={() => createSlotAndToggle(col.dayIdx, col.blockIdx, roleName, !!isTrial, a.personId)}
                                    >
                                      {a.name}
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="build-tab__cell-empty">-</span>
                            })()}
                          </td>
                        )
                      }
                      return (
                        <td
                          key={ci}
                          className={`build-tab__cell build-tab__cell--na ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}
                        />
                      )
                    }

                    const cellKey = `${col.dayIdx}-${col.blockIdx}-${slotIdx}`
                    const isDragOver = dragOverCell === cellKey
                    const isDropdownOpen = openDropdown &&
                      openDropdown.dayIdx === col.dayIdx &&
                      openDropdown.blockIdx === col.blockIdx &&
                      openDropdown.slotIdx === slotIdx &&
                      openDropdown.rowType === 'role'

                    return (
                      <td
                        key={ci}
                        className={`build-tab__cell ${isDragOver ? 'build-tab__cell--drag-over' : ''} ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}
                        onDragOver={e => handleDragOver(e, cellKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, col.dayIdx, col.blockIdx, slotIdx)}
                        onClick={(e) => {
                          if (!isDropdownOpen) {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setOpenDropdown({ dayIdx: col.dayIdx, blockIdx: col.blockIdx, slotIdx, rowType: 'role', rect: { top: r.bottom, left: r.left + r.width / 2, width: r.width, height: r.height } })
                          }
                        }}
                      >
                        {(() => {
                          const day = days[col.dayIdx]
                          const availKey = `${day.isoDate}|${block.startTime || block.time}`
                          const allAvail = availabilityMap[availKey] || []
                          const forRole = isTrial
                            ? allAvail.filter(a => roleMatchesFamily(a.role, roleName) && a.scheduleStatus === 'tryout')
                            : isSub
                              ? allAvail.filter(a => a.scheduleStatus === 'sub')
                              : allAvail.filter(a => roleMatchesFamily(a.role, roleName) && a.scheduleStatus === 'main')
                          const assignedIds = new Set(getSlotPlayerIds(slot))
                          const hasRinger = slot.isRinger && slot.ringerName

                          const chips: React.ReactNode[] = []

                          if (hasRinger) {
                            const isEditing = editingRinger &&
                              editingRinger.dayIdx === col.dayIdx &&
                              editingRinger.blockIdx === col.blockIdx &&
                              editingRinger.slotIdx === slotIdx
                            const isPlaceholder = slot.ringerName === 'Ringer Needed'

                            chips.push(
                              isEditing ? (
                                <div key="ringer-edit" className="build-tab__ringer-edit" onClick={e => e.stopPropagation()}>
                                  <input
                                    ref={ringerEditRef}
                                    className="build-tab__ringer-edit-input"
                                    type="text"
                                    placeholder="Ringer name..."
                                    value={editingRingerName}
                                    onChange={e => setEditingRingerName(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        updateRingerName(col.dayIdx, col.blockIdx, slotIdx, editingRingerName.trim())
                                      }
                                      if (e.key === 'Escape') setEditingRinger(null)
                                    }}
                                    onBlur={() => {
                                      if (editingRingerName.trim()) {
                                        updateRingerName(col.dayIdx, col.blockIdx, slotIdx, editingRingerName.trim())
                                      } else {
                                        setEditingRinger(null)
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <span
                                  key="ringer"
                                  className={`build-tab__avail-chip build-tab__avail-chip--ringer build-tab__avail-chip--clickable ${isPlaceholder ? 'build-tab__avail-chip--ringer-placeholder' : ''}`}
                                  style={{ borderColor: '#fbbf24' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingRingerName(isPlaceholder ? '' : (slot.ringerName || ''))
                                    setEditingRinger({ dayIdx: col.dayIdx, blockIdx: col.blockIdx, slotIdx })
                                    setTimeout(() => ringerEditRef.current?.focus(), 0)
                                  }}
                                >
                                  {slot.ringerName} (R)
                                  <button
                                    className="build-tab__ringer-remove"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeRinger(col.dayIdx, col.blockIdx, slotIdx)
                                    }}
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              )
                            )
                          }

                          forRole.forEach(a => {
                            const isAssigned = assignedIds.has(a.personId)
                            chips.push(
                              <span
                                key={a.personId}
                                className={`build-tab__avail-chip build-tab__avail-chip--clickable ${a.status === 'maybe' ? 'build-tab__avail-chip--maybe' : ''} ${isAssigned ? 'build-tab__avail-chip--assigned' : ''} ${isTrial ? 'build-tab__avail-chip--trial' : ''}`}
                                style={{ borderColor: color }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleSlotPlayer(col.dayIdx, col.blockIdx, slotIdx, a.personId)
                                }}
                              >
                                {a.name}
                              </span>
                            )
                          })

                          if (chips.length === 0 && assignedIds.size > 0) {
                            for (const pid of assignedIds) {
                              chips.push(
                                <span key={pid} className={`build-tab__avail-chip build-tab__avail-chip--assigned ${isTrial ? 'build-tab__avail-chip--trial' : ''}`} style={{ borderColor: color }}>
                                  {playerMap[pid] || 'Unknown'}
                                </span>
                              )
                            }
                          }

                          return chips.length > 0 ? (
                            <div className="build-tab__cell-avail-players">{chips}</div>
                          ) : (
                            <span className="build-tab__cell-empty">-</span>
                          )
                        })()}
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            <tr className="build-tab__meta-row build-tab__meta-row--separator">
              <td className="build-tab__role-label build-tab__role-label--meta">
                <span className="build-tab__role-label-text build-tab__role-label-text--meta">Activity</span>
              </td>
              {columns.map((col, ci) => {
                const block = days[col.dayIdx]?.blocks[col.blockIdx]
                if (!block) return <td key={ci} className="build-tab__cell build-tab__cell--empty" />
                const activity = getBlockActivity(block)
                const activityLabel = ACTIVITY_TYPES.find(a => a.value === activity)?.label || activity
                const isDropdownOpen = openDropdown &&
                  openDropdown.dayIdx === col.dayIdx &&
                  openDropdown.blockIdx === col.blockIdx &&
                  openDropdown.rowType === 'activity'

                return (
                  <td
                    key={ci}
                    className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}
                    onClick={(e) => {
                      if (!isDropdownOpen) {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setOpenDropdown({ dayIdx: col.dayIdx, blockIdx: col.blockIdx, slotIdx: -1, rowType: 'activity', rect: { top: r.bottom, left: r.left + r.width / 2, width: r.width, height: r.height } })
                      }
                    }}
                  >
                    <span className={`build-tab__activity-badge build-tab__activity-badge--${activity}`}>
                      {activityLabel}
                    </span>
                  </td>
                )
              })}
            </tr>

            <tr className="build-tab__meta-row">
              <td className="build-tab__role-label build-tab__role-label--meta">
                <span className="build-tab__role-label-text build-tab__role-label-text--meta">Opponent</span>
              </td>
              {columns.map((col, ci) => {
                const block = days[col.dayIdx]?.blocks[col.blockIdx]
                if (!block) return <td key={ci} className="build-tab__cell build-tab__cell--empty" />
                const isOpponentBlock = OPPONENT_ACTIVITIES.has(getBlockActivity(block))
                if (!isOpponentBlock) return <td key={ci} className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`} />
                const opponentName = block.scrim?.opponent || ''
                const hasScrimDetails = !!(block.scrim?.contact || block.scrim?.opponentRoster || block.scrim?.notes)

                return (
                  <td
                    key={ci}
                    className={`build-tab__cell build-tab__cell--meta build-tab__cell--clickable ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}
                    onClick={() => setScrimModal({ dayIdx: col.dayIdx, blockIdx: col.blockIdx })}
                  >
                    {opponentName ? (
                      <span className="build-tab__opponent-name">
                        {opponentName}
                        {hasScrimDetails && <span className="build-tab__scrim-details-dot" />}
                      </span>
                    ) : (
                      <span className="build-tab__cell-empty build-tab__cell-empty--clickable build-tab__cell-empty--tbd">TBD</span>
                    )}
                  </td>
                )
              })}
            </tr>

            <tr className="build-tab__meta-row">
              <td className="build-tab__role-label build-tab__role-label--meta">
                <span className="build-tab__role-label-text build-tab__role-label-text--meta">Remind</span>
              </td>
              {columns.map((col, ci) => {
                const block = days[col.dayIdx]?.blocks[col.blockIdx]
                if (!block) return <td key={ci} className="build-tab__cell build-tab__cell--empty" />
                if (!OPPONENT_ACTIVITIES.has(getBlockActivity(block))) return <td key={ci} className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`} />
                const day = days[col.dayIdx]
                const remKey = `${day.date}|${block.time}`
                const isSending = reminderSending === remKey
                const wasSent = reminderSent.has(remKey)

                return (
                  <td
                    key={ci}
                    className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}
                  >
                    <button
                      className={`build-tab__reminder-btn ${wasSent ? 'build-tab__reminder-btn--sent' : ''}`}
                      disabled={isSending}
                      onClick={() => handleSendReminder(day.date, block.time)}
                    >
                      {isSending ? (
                        <><Loader2 size={12} className="build-tab__spinner" /> Sending</>
                      ) : wasSent ? (
                        <><CheckCircle size={12} /> Sent</>
                      ) : (
                        <><Bell size={12} /> Remind</>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>

            <tr className="build-tab__meta-row">
              <td className="build-tab__role-label build-tab__role-label--meta">
                <span className="build-tab__role-label-text build-tab__role-label-text--meta">Outcome</span>
              </td>
              {columns.map((col, ci) => {
                const block = days[col.dayIdx]?.blocks[col.blockIdx]
                if (!block) return <td key={ci} className="build-tab__cell build-tab__cell--empty" />
                if (!OPPONENT_ACTIVITIES.has(getBlockActivity(block))) return <td key={ci} className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`} />
                const hasOutcome = !!(block.outcome?.ourRating || block.outcome?.opponentRating || block.outcome?.worthScrimAgain)
                const OUTCOME_MAP: Record<string, string> = { easywin: 'Easy W', closewin: 'Close W', neutral: 'Neutral', closeloss: 'Close L', gotrolled: 'Rolled' }
                const outcomeLabel = hasOutcome
                  ? (block.outcome?.ourRating ? OUTCOME_MAP[block.outcome.ourRating] : null) || 'Logged'
                  : null
                return (
                  <td
                    key={ci}
                    className={`build-tab__cell build-tab__cell--meta ${col.isFirstOfDay && ci > 0 ? 'build-tab__cell--day-start' : ''}`}
                  >
                    <button
                      className={`build-tab__outcome-btn ${hasOutcome ? 'build-tab__outcome-btn--filled' : ''}`}
                      onClick={() => setOutcomeModal({ dayIdx: col.dayIdx, blockIdx: col.blockIdx })}
                    >
                      <ClipboardList size={12} />
                      {hasOutcome ? outcomeLabel : 'Log'}
                    </button>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {openDropdown?.rect && (
        <div className="build-tab__dropdown-overlay" onClick={() => { setOpenDropdown(null); setRingerInput(null) }}>
          <div
            ref={dropdownRef}
            className="build-tab__dropdown build-tab__dropdown--fixed"
            style={{ top: openDropdown.rect.top, left: openDropdown.rect.left }}
            onClick={e => e.stopPropagation()}
          >
            {openDropdown.rowType === 'role' && (() => {
              const block = days[openDropdown.dayIdx]?.blocks[openDropdown.blockIdx]
              const slot = block?.slots[openDropdown.slotIdx]
              if (!slot) return null
              const day = days[openDropdown.dayIdx]
              const availKey = `${day?.isoDate}|${block.startTime || block.time}`
              const allAvail = availabilityMap[availKey] || []
              const availableHere = new Set(allAvail.filter(a => roleMatchesFamily(a.role, slot.role)).map(a => a.personId))
              const respondedIds = new Set(respondedPlayers.map(p => p.id))
              const sorted = [...rosterPlayers].sort((a, b) => {
                const aAvail = availableHere.has(a.id) ? 0 : 1
                const bAvail = availableHere.has(b.id) ? 0 : 1
                if (aAvail !== bAvail) return aAvail - bAvail
                const aResponded = respondedIds.has(a.id) ? 0 : 1
                const bResponded = respondedIds.has(b.id) ? 0 : 1
                return aResponded - bResponded
              })
              const slotAssigned = new Set(getSlotPlayerIds(slot))
              return (
                <div className="build-tab__dropdown-scroll">
                  {(slotAssigned.size > 0 || slot.isRinger) && (
                    <button
                      className="build-tab__dropdown-item build-tab__dropdown-item--clear"
                      onClick={() => updateSlot(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, null)}
                    >
                      Clear All
                    </button>
                  )}
                  {sorted.map(p => (
                    <button
                      key={p.id}
                      className={`build-tab__dropdown-item ${slotAssigned.has(p.id) ? 'build-tab__dropdown-item--active' : ''} ${!availableHere.has(p.id) ? 'build-tab__dropdown-item--unavailable' : ''}`}
                      onClick={() => {
                        toggleSlotPlayer(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, p.id)
                      }}
                    >
                      {availableHere.has(p.id) && <span className="build-tab__dropdown-avail-dot" />}
                      {p.name}{p.isSub ? ' (S)' : ''}
                    </button>
                  ))}
                  <div className="build-tab__dropdown-ringer-divider" />
                  <button
                    className="build-tab__dropdown-item build-tab__dropdown-item--need-ringer"
                    onClick={() => {
                      setSlotRinger(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, 'Ringer Needed')
                    }}
                  >
                    Need Ringer
                  </button>
                  {ringerInput === null ? (
                    <button
                      className="build-tab__dropdown-item build-tab__dropdown-item--ringer"
                      onClick={() => {
                        setRingerInput('')
                        setTimeout(() => ringerInputRef.current?.focus(), 0)
                      }}
                    >
                      + Add Named Ringer
                    </button>
                  ) : (
                    <div className="build-tab__dropdown-ringer-form">
                      <input
                        ref={ringerInputRef}
                        className="build-tab__dropdown-ringer-input"
                        type="text"
                        placeholder="Ringer name..."
                        value={ringerInput}
                        onChange={e => setRingerInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && ringerInput.trim()) {
                            setSlotRinger(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, ringerInput.trim())
                          }
                          if (e.key === 'Escape') setRingerInput(null)
                        }}
                      />
                      <button
                        className="build-tab__dropdown-ringer-confirm"
                        disabled={!ringerInput?.trim()}
                        onClick={() => {
                          if (ringerInput?.trim()) {
                            setSlotRinger(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, ringerInput.trim())
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
            {openDropdown.rowType === 'activity' && (() => {
              const block = days[openDropdown.dayIdx]?.blocks[openDropdown.blockIdx]
              if (!block) return null
              const currentActivity = getBlockActivity(block)
              return (
                <>
                  {ACTIVITY_TYPES.map(opt => (
                    <button
                      key={opt.value}
                      className={`build-tab__dropdown-item ${currentActivity === opt.value ? 'build-tab__dropdown-item--active' : ''}`}
                      onClick={() => updateActivity(openDropdown.dayIdx, openDropdown.blockIdx, opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {scrimModal && (() => {
        const block = days[scrimModal.dayIdx]?.blocks[scrimModal.blockIdx]
        if (!block) return null
        const scrim = block.scrim || { opponent: '', opponentRoster: '', contact: '', host: '' as const, mapPool: '', heroBans: true, staggers: false, notes: '' }
        const day = days[scrimModal.dayIdx]
        const dayLabel = getDayLabel(day.date)
        const timeLabel = block.time

        return (
          <div className="build-tab__scrim-overlay" onClick={() => setScrimModal(null)}>
            <div className="build-tab__scrim-modal" onClick={e => e.stopPropagation()}>
              <div className="build-tab__scrim-modal-header">
                <h3 className="build-tab__scrim-modal-title">Scrim Details</h3>
                <span className="build-tab__scrim-modal-subtitle">{dayLabel} {timeLabel}</span>
                <button className="build-tab__scrim-modal-close" onClick={() => setScrimModal(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="build-tab__scrim-modal-body">
                <div className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Opponent</span>
                  <div className="build-tab__scrim-opponent-row">
                    <div className="build-tab__scrim-picker">
                      <button
                        type="button"
                        className="build-tab__scrim-picker-btn"
                        onClick={() => setOpponentPickerOpen(v => !v)}
                      >
                        {scrim.opponentTeamId
                          ? opponentTeams.find(t => t.id === scrim.opponentTeamId)?.name || scrim.opponent
                          : 'Select team...'}
                      </button>
                      {opponentPickerOpen && (
                        <>
                          <div className="build-tab__scrim-picker-backdrop" onClick={() => setOpponentPickerOpen(false)} />
                          <div className="build-tab__scrim-picker-list">
                            {scrim.opponentTeamId && (
                              <button
                                type="button"
                                className="build-tab__scrim-picker-item build-tab__scrim-picker-item--clear"
                                onClick={() => {
                                  updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { opponentTeamId: null, opponent: '' })
                                  setOpponentPickerOpen(false)
                                }}
                              >
                                Clear
                              </button>
                            )}
                            {opponentTeams.map(t => (
                              <button
                                key={t.id}
                                type="button"
                                className={`build-tab__scrim-picker-item ${scrim.opponentTeamId === t.id ? 'build-tab__scrim-picker-item--active' : ''}`}
                                onClick={() => {
                                  updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { opponentTeamId: t.id, opponent: t.name })
                                  setOpponentPickerOpen(false)
                                }}
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <span className="build-tab__scrim-or">or</span>
                    <input
                      className="build-tab__scrim-input"
                      type="text"
                      placeholder="Type team name"
                      value={!scrim.opponentTeamId ? scrim.opponent : ''}
                      onChange={e => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { opponentTeamId: null, opponent: e.target.value })}
                    />
                  </div>
                </div>

                <label className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Contact</span>
                  <input
                    className="build-tab__scrim-input"
                    type="text"
                    placeholder="Discord username or tag"
                    value={scrim.contact}
                    onChange={e => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { contact: e.target.value })}
                  />
                </label>

                <label className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Their Roster</span>
                  <input
                    className="build-tab__scrim-input"
                    type="text"
                    placeholder="e.g. 4200 avg, OWCS team"
                    value={scrim.opponentRoster}
                    onChange={e => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { opponentRoster: e.target.value })}
                  />
                </label>

                <div className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Host</span>
                  <div className="build-tab__scrim-toggle-row">
                    <button
                      className={`build-tab__scrim-toggle ${scrim.host === 'us' ? 'build-tab__scrim-toggle--active' : ''}`}
                      onClick={() => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { host: scrim.host === 'us' ? '' : 'us' })}
                    >
                      Us
                    </button>
                    <button
                      className={`build-tab__scrim-toggle ${scrim.host === 'them' ? 'build-tab__scrim-toggle--active' : ''}`}
                      onClick={() => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { host: scrim.host === 'them' ? '' : 'them' })}
                    >
                      Them
                    </button>
                  </div>
                </div>

                <label className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Map Pool</span>
                  <input
                    className="build-tab__scrim-input"
                    type="text"
                    placeholder="e.g. Comp maps, all maps, specific maps"
                    value={scrim.mapPool}
                    onChange={e => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { mapPool: e.target.value })}
                  />
                </label>

                <div className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Rules</span>
                  <div className="build-tab__scrim-toggle-row">
                    <button
                      className={`build-tab__scrim-toggle ${scrim.heroBans ? 'build-tab__scrim-toggle--active' : ''}`}
                      onClick={() => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { heroBans: !scrim.heroBans })}
                    >
                      Hero Bans
                    </button>
                    <button
                      className={`build-tab__scrim-toggle ${scrim.staggers ? 'build-tab__scrim-toggle--active' : ''}`}
                      onClick={() => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { staggers: !scrim.staggers })}
                    >
                      Staggers
                    </button>
                  </div>
                </div>

                <label className="build-tab__scrim-field">
                  <span className="build-tab__scrim-field-label">Notes</span>
                  <textarea
                    className="build-tab__scrim-textarea"
                    placeholder="Any additional notes..."
                    rows={3}
                    value={scrim.notes}
                    onChange={e => updateScrimDetails(scrimModal.dayIdx, scrimModal.blockIdx, { notes: e.target.value })}
                  />
                </label>
              </div>

              <div className="build-tab__scrim-modal-footer">
                <button className="build-tab__scrim-modal-done" onClick={() => setScrimModal(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {outcomeModal && (() => {
        const block = days[outcomeModal.dayIdx]?.blocks[outcomeModal.blockIdx]
        if (!block) return null
        const outcome = block.outcome || {}
        const day = days[outcomeModal.dayIdx]
        const opponentName = block.scrim?.opponent || opponentTeams.find(t => t.id === block.scrim?.opponentTeamId)?.name || 'Unknown'

        const ourOptions: { value: string; label: string }[] = [
          { value: 'easywin', label: 'Easy Win' },
          { value: 'closewin', label: 'Close Win' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'closeloss', label: 'Close Loss' },
          { value: 'gotrolled', label: 'Got Rolled' },
        ]
        const theirOptions: { value: string; label: string }[] = [
          { value: 'weak', label: 'Weak' },
          { value: 'average', label: 'Average' },
          { value: 'strong', label: 'Strong' },
          { value: 'verystrong', label: 'Very Strong' },
        ]
        const againOptions: { value: string; label: string }[] = [
          { value: 'yes', label: 'Yes' },
          { value: 'maybe', label: 'Maybe' },
          { value: 'no', label: 'No' },
        ]

        return (
          <div className="build-tab__scrim-overlay" onClick={() => setOutcomeModal(null)}>
            <div className="build-tab__outcome-modal" onClick={e => e.stopPropagation()}>
              <div className="build-tab__scrim-modal-header">
                <ClipboardList size={18} />
                <div>
                  <h3>Scrim Outcome</h3>
                  <span>vs {opponentName} - {day.date} {block.time}</span>
                </div>
                <button onClick={() => setOutcomeModal(null)}><X size={16} /></button>
              </div>

              <div className="build-tab__outcome-modal-body">
                <div className="build-tab__outcome-field">
                  <label>Our Performance</label>
                  <div className="build-tab__outcome-toggles">
                    {ourOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={`build-tab__outcome-toggle ${outcome.ourRating === opt.value ? 'build-tab__outcome-toggle--active' : ''}`}
                        onClick={() => updateOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                          ourRating: outcome.ourRating === opt.value ? undefined : opt.value as any,
                        })}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="build-tab__outcome-field">
                  <label>Opponent Strength</label>
                  <div className="build-tab__outcome-toggles">
                    {theirOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={`build-tab__outcome-toggle ${outcome.opponentRating === opt.value ? 'build-tab__outcome-toggle--active' : ''}`}
                        onClick={() => updateOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                          opponentRating: outcome.opponentRating === opt.value ? undefined : opt.value as any,
                        })}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="build-tab__outcome-field">
                  <label>Worth Scrimming Again?</label>
                  <div className="build-tab__outcome-toggles">
                    {againOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={`build-tab__outcome-toggle ${outcome.worthScrimAgain === opt.value ? 'build-tab__outcome-toggle--active' : ''}`}
                        onClick={() => updateOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                          worthScrimAgain: outcome.worthScrimAgain === opt.value ? undefined : opt.value as any,
                        })}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="build-tab__outcome-field">
                  <label>Notes</label>
                  <textarea
                    className="build-tab__scrim-textarea"
                    placeholder="Post-scrim thoughts, areas to improve..."
                    rows={3}
                    value={outcome.scrimNotes || ''}
                    onChange={e => updateOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, { scrimNotes: e.target.value })}
                  />
                </div>
              </div>

              <div className="build-tab__scrim-modal-footer">
                <button className="build-tab__scrim-modal-done" onClick={() => setOutcomeModal(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
