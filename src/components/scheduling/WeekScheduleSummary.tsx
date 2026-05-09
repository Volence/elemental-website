'use client'

import React, { useMemo } from 'react'
import { Calendar, Swords, Search } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import './WeekScheduleSummary.css'

interface PlayerSlot {
  role: string
  playerId: string | null
  playerIds?: string[]
  isRinger?: boolean
  ringerName?: string
  isTrial?: boolean
}

interface ScrimData {
  isScrim?: boolean
  opponentTeamId?: number | null
  opponent: string
  host: 'us' | 'them' | ''
  mapPool: string
  heroBans: boolean
  staggers: boolean
  notes: string
}

interface TimeBlock {
  time: string
  slots: PlayerSlot[]
  scrim?: ScrimData
}

interface DaySchedule {
  date: string
  enabled: boolean
  blocks: TimeBlock[]
}

interface RoleColor { label: string; color: string }

const SPECIFIC_ROLES: RoleColor[] = [
  { label: 'Tank', color: '#00e5ff' },
  { label: 'Hitscan', color: '#ff3e8a' },
  { label: 'Flex DPS', color: '#ff9f1c' },
  { label: 'Main Support', color: '#00ff9f' },
  { label: 'Flex Support', color: '#b44dff' },
  { label: 'Coach', color: '#94a3b8' },
]

const GENERIC_ROLES: RoleColor[] = [
  { label: 'Tank', color: '#00e5ff' },
  { label: 'DPS', color: '#ff3e8a' },
  { label: 'Support', color: '#00ff9f' },
  { label: 'Coach', color: '#94a3b8' },
]

const CUSTOM_COLORS = ['#00e5ff', '#ff3e8a', '#ff9f1c', '#00ff9f', '#b44dff', '#f59e0b', '#ec4899', '#06b6d4']

function getRoleColor(roleName: string, team: any): string {
  const preset = team.rolePreset || 'specific'
  if (preset === 'generic') {
    return GENERIC_ROLES.find(r => r.label === roleName)?.color || '#94a3b8'
  }
  if (preset === 'custom' && team.customRoles) {
    const customs = team.customRoles.split(',').map((r: string) => r.trim())
    const idx = customs.indexOf(roleName)
    if (idx >= 0) return CUSTOM_COLORS[idx % CUSTOM_COLORS.length]
  }
  return SPECIFIC_ROLES.find(r => r.label === roleName)?.color || '#94a3b8'
}

function getSlotPlayerIds(slot: PlayerSlot): string[] {
  if (slot.playerIds?.length) return slot.playerIds
  if (slot.playerId) return [slot.playerId]
  return []
}

export function WeekScheduleSummary() {
  const { data, viewedCalendar } = useSchedule()

  const schedule = viewedCalendar?.schedule as { days: DaySchedule[] } | null

  const responses = viewedCalendar?.responses || []

  const playerMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of [...data.team.roster, ...data.team.subs]) {
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
  }, [data.team.roster, data.team.subs, responses])

  const scrimDays = useMemo(() => {
    if (!schedule?.days) return []
    const result: { date: string; blocks: (TimeBlock & { blockNum?: number })[] }[] = []
    for (const day of schedule.days) {
      if (!day.enabled) continue
      const scrimBlocks = day.blocks.filter(
        b => b.scrim?.isScrim || b.scrim?.opponent || b.scrim?.opponentTeamId
      )
      if (scrimBlocks.length === 0) continue
      result.push({
        date: day.date,
        blocks: scrimBlocks.map((b, i) => ({
          ...b,
          blockNum: scrimBlocks.length > 1 ? i + 1 : undefined,
        })),
      })
    }
    return result
  }, [schedule])

  if (!schedule || scrimDays.length === 0) return null

  return (
    <div className="week-schedule">
      <div className="week-schedule__header">
        <Calendar size={18} />
        <h3 className="week-schedule__title">This Week's Schedule</h3>
        <span className="week-schedule__count">{scrimDays.reduce((n, d) => n + d.blocks.length, 0)} scrim{scrimDays.reduce((n, d) => n + d.blocks.length, 0) !== 1 ? 's' : ''}</span>
      </div>
      <div className="week-schedule__days">
        {scrimDays.map((day, di) => (
          <div key={di} className="week-schedule__day">
            {day.blocks.map((block, bi) => {
              const mainSlots = block.slots.filter(s => !s.isTrial)
              const trialSlots = block.slots.filter(s => s.isTrial && getSlotPlayerIds(s).length > 0)
              const opponent = block.scrim?.opponent
              const host = block.scrim?.host
              const filledCount = mainSlots.filter(s => getSlotPlayerIds(s).length > 0 || (s.isRinger && s.ringerName)).length
              const totalCount = mainSlots.length
              const isFull = filledCount === totalCount && totalCount > 0

              return (
                <div key={bi} className={`week-schedule__block ${opponent ? 'week-schedule__block--has-opponent' : ''}`}>
                  <div className="week-schedule__block-top">
                    <div className="week-schedule__block-header">
                      <span className="week-schedule__block-day">{day.date}</span>
                      <span className="week-schedule__block-time">
                        {block.blockNum ? `Block ${block.blockNum} - ` : ''}{block.time}
                      </span>
                    </div>
                    <div className="week-schedule__block-opponent">
                      {opponent ? (
                        <>
                          <Swords size={14} className="week-schedule__swords-icon" />
                          <span className="week-schedule__opponent-name">{opponent}</span>
                          {host && (
                            <span className="week-schedule__host-badge">
                              {host === 'us' ? 'We host' : 'They host'}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Search size={14} className="week-schedule__search-icon" />
                          <span className="week-schedule__opponent-tbd">Looking for Scrim</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="week-schedule__roster">
                    {mainSlots.map((slot, si) => {
                      const ids = getSlotPlayerIds(slot)
                      const color = getRoleColor(slot.role, data.team)
                      let name: string
                      let isRingerSlot = false
                      if (slot.isRinger && slot.ringerName) {
                        isRingerSlot = true
                        name = slot.ringerName === 'Ringer Needed'
                          ? 'Ringer Needed'
                          : `${slot.ringerName} (R)`
                      } else if (ids.length > 0) {
                        name = ids.map(id => playerMap[id] || '?').join(', ')
                      } else {
                        name = '-'
                      }
                      return (
                        <div key={si} className="week-schedule__slot">
                          <span className="week-schedule__slot-bar" style={{ background: color }} />
                          <span className="week-schedule__slot-role" style={{ color }}>{slot.role}</span>
                          <span className={`week-schedule__slot-player ${name === '-' ? 'week-schedule__slot-player--empty' : ''} ${isRingerSlot ? 'week-schedule__slot-player--ringer' : ''}`}>
                            {name}
                          </span>
                        </div>
                      )
                    })}
                    {trialSlots.length > 0 && (
                      <>
                        <div className="week-schedule__trial-divider">Trials</div>
                        {trialSlots.map((slot, si) => {
                          const ids = getSlotPlayerIds(slot)
                          const color = getRoleColor(slot.role, data.team)
                          const name = ids.map(id => playerMap[id] || '?').join(', ')
                          return (
                            <div key={`trial-${si}`} className="week-schedule__slot week-schedule__slot--trial">
                              <span className="week-schedule__slot-bar" style={{ background: color, opacity: 0.5 }} />
                              <span className="week-schedule__slot-role" style={{ color }}>{slot.role}</span>
                              <span className="week-schedule__slot-player">{name}</span>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                  <div className="week-schedule__block-footer">
                    <span className={`week-schedule__roster-status ${isFull ? 'week-schedule__roster-status--full' : ''}`}>
                      {isFull ? 'Roster confirmed' : `${filledCount}/${totalCount} filled`}
                    </span>
                    {block.scrim?.mapPool && (
                      <span className="week-schedule__map-pool">Maps: {block.scrim.mapPool}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
