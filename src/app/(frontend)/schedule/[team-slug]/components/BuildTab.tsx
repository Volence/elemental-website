'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Wrench, Lightbulb, RefreshCw, Save, Send, ChevronDown, ChevronRight, Plus, Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useSchedule } from '@/components/scheduling/ScheduleContext'
import { suggestLineup } from '@/components/scheduling/AutoLineup'
import type { RosterEntry } from '@/components/scheduling/types'
import './BuildTab.css'

interface PlayerSlot {
  role: string
  playerId: string | null
  isRinger?: boolean
  ringerName?: string
}

interface TimeBlock {
  id: string
  time: string
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
}

interface DaySchedule {
  date: string
  enabled: boolean
  blocks: TimeBlock[]
}

const ROLE_PRESETS: Record<string, string[]> = {
  specific: ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
  generic: ['Tank', 'DPS', 'DPS', 'Support', 'Support'],
}

export function BuildTab() {
  const { data, refreshData } = useSchedule()
  const { activeCalendar, team } = data

  const [days, setDays] = useState<DaySchedule[]>([])
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]))
  const [opponentTeams, setOpponentTeams] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roles = useMemo(() => {
    let preset = team.rolePreset || 'specific'
    if (preset === 'custom' && team.customRoles) {
      return team.customRoles.split(',').map(r => r.trim()).filter(Boolean)
    }
    if (preset === 'specific') preset = 'specific'
    return ROLE_PRESETS[preset] || ROLE_PRESETS.specific
  }, [team.rolePreset, team.customRoles])

  const playerMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of [...team.roster, ...team.subs]) {
      if (entry.person) {
        map[String(entry.person.id)] = entry.person.name || 'Unknown'
      }
    }
    return map
  }, [team.roster, team.subs])

  const rosterPlayers = useMemo(() => {
    return [...team.roster, ...team.subs]
      .filter(e => e.person)
      .map(e => ({
        id: String(e.person.id),
        name: e.person.name || 'Unknown',
        role: e.role,
        isSub: team.subs.some(s => s.person?.id === e.person.id),
      }))
  }, [team.roster, team.subs])

  const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const createDefaultBlock = useCallback((time: string): TimeBlock => ({
    id: generateBlockId(),
    time,
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

  // Initialize schedule days from calendar
  useEffect(() => {
    if (!activeCalendar) return

    // Use existing schedule if available
    if (activeCalendar.schedule?.days?.length) {
      setDays(activeCalendar.schedule.days)
      return
    }

    // Create from date range + schedule blocks
    const { dateRange, timeSlots } = activeCalendar
    if (!dateRange?.start || !dateRange?.end) return

    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    const newDays: DaySchedule[] = []
    const current = new Date(start)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      const dayName = current.toLocaleDateString('en-US', { weekday: 'long' })
      const dateLabel = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const blocks = (timeSlots || team.scheduleBlocks || []).map((slot: any) =>
        createDefaultBlock(slot.label || slot.startTime || '8-10')
      )
      newDays.push({ date: `${dayName} ${dateLabel}`, enabled: true, blocks })
      current.setDate(current.getDate() + 1)
    }

    setDays(newDays)
  }, [activeCalendar, team.scheduleBlocks, createDefaultBlock])

  // Fetch opponent teams
  useEffect(() => {
    fetch('/api/opponent-teams?limit=100&sort=name')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.docs) setOpponentTeams(data.docs) })
      .catch(() => {})
  }, [])

  const toggleDay = (index: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleDayEnabled = (index: number) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, enabled: !d.enabled } : d))
    setSaved(false)
  }

  const updateSlot = (dayIdx: number, blockIdx: number, slotIdx: number, playerId: string | null) => {
    setDays(prev => prev.map((day, di) => {
      if (di !== dayIdx) return day
      return {
        ...day,
        blocks: day.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block
          return {
            ...block,
            slots: block.slots.map((slot, si) => si === slotIdx ? { ...slot, playerId } : slot),
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
              opponentTeamId: opponentId,
              opponent: opponent?.name || '',
            },
          }
        }),
      }
    }))
    setSaved(false)
  }

  const addBlock = (dayIdx: number) => {
    const time = team.scheduleBlocks?.[0]?.label || '8-10'
    setDays(prev => prev.map((day, i) => i === dayIdx ? { ...day, blocks: [...day.blocks, createDefaultBlock(time)] } : day))
    setSaved(false)
  }

  const removeBlock = (dayIdx: number, blockIdx: number) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIdx) return day
      return { ...day, blocks: day.blocks.filter((_, bi) => bi !== blockIdx) }
    }))
    setSaved(false)
  }

  const handleSuggest = () => {
    if (!activeCalendar?.responses) return
    const suggested = suggestLineup(
      days,
      team.roster as RosterEntry[],
      team.subs as RosterEntry[],
      activeCalendar.responses,
      roles,
    )
    setDays(suggested)
    setSaved(false)
  }

  const handleRecalculate = () => {
    setDays(prev => prev.map(day => ({
      ...day,
      blocks: day.blocks.map(block => ({
        ...block,
        slots: block.slots.map(slot => ({ ...slot, playerId: null })),
      })),
    })))
    setTimeout(() => handleSuggest(), 0)
  }

  const handleSave = async () => {
    if (!activeCalendar) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/discord-polls/${activeCalendar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule: { days, lastUpdated: new Date().toISOString() },
        }),
      })
      if (!res.ok) throw new Error('Failed to save schedule')
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
    if (!activeCalendar) return
    setPublishing(true)
    setError(null)
    try {
      const { publishScheduleAction } = await import('@/actions/publish-schedule')
      const result = await publishScheduleAction(Number(activeCalendar.id))
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

  if (!activeCalendar) {
    return (
      <div className="build-tab build-tab--empty">
        <Wrench size={32} />
        <p>No active calendar to build a schedule for.</p>
      </div>
    )
  }

  const hasChanges = activeCalendar.availabilityChangedAfterSchedule

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
            <Lightbulb size={14} /> Suggest Lineup
          </button>
          <button className="build-tab__recalc-btn" onClick={handleRecalculate}>
            <RefreshCw size={14} /> Recalculate
          </button>
        </div>
      </div>

      <div className="build-tab__days">
        {days.map((day, dayIdx) => (
          <div key={dayIdx} className={`build-tab__day ${!day.enabled ? 'build-tab__day--disabled' : ''}`}>
            <div className="build-tab__day-header" onClick={() => toggleDay(dayIdx)}>
              {expandedDays.has(dayIdx) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="build-tab__day-date">{day.date}</span>
              <label className="build-tab__day-toggle" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={() => toggleDayEnabled(dayIdx)}
                />
                <span className="build-tab__day-toggle-label">{day.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

            {expandedDays.has(dayIdx) && day.enabled && (
              <div className="build-tab__day-content">
                {day.blocks.map((block, blockIdx) => (
                  <div key={block.id} className="build-tab__block">
                    <div className="build-tab__block-header">
                      <span className="build-tab__block-time">{block.time}</span>
                      {opponentTeams.length > 0 && (
                        <select
                          className="build-tab__opponent-select"
                          value={block.scrim?.opponentTeamId || ''}
                          onChange={e => updateScrimOpponent(dayIdx, blockIdx, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">No opponent</option>
                          {opponentTeams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                      {day.blocks.length > 1 && (
                        <button className="build-tab__remove-block" onClick={() => removeBlock(dayIdx, blockIdx)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="build-tab__slots">
                      {block.slots.map((slot, slotIdx) => (
                        <div key={slotIdx} className="build-tab__slot">
                          <span className="build-tab__slot-role">{slot.role}</span>
                          <select
                            className="build-tab__slot-select"
                            value={slot.playerId || ''}
                            onChange={e => updateSlot(dayIdx, blockIdx, slotIdx, e.target.value || null)}
                          >
                            <option value="">-- Select --</option>
                            {rosterPlayers.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.isSub ? ' (Sub)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="build-tab__add-block" onClick={() => addBlock(dayIdx)}>
                  <Plus size={14} /> Add Time Block
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="build-tab__actions">
        {error && <span className="build-tab__error">{error}</span>}
        <button className="build-tab__save-btn" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={16} className="build-tab__spinner" /> Saving...</> :
           saved ? <><CheckCircle size={16} /> Saved!</> :
           <><Save size={16} /> Save Schedule</>}
        </button>
        <button className="build-tab__publish-btn" onClick={handlePublish} disabled={publishing || saving}>
          {publishing ? <><Loader2 size={16} className="build-tab__spinner" /> Publishing...</> :
           published ? <><CheckCircle size={16} /> Published!</> :
           <><Send size={16} /> Post to Discord</>}
        </button>
      </div>
    </div>
  )
}
