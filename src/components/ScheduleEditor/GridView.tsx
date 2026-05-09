'use client'

import React, { useState, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import { ReminderButton } from './ReminderButton'
import { ScrimOutcomeButton } from './ScrimOutcomeButton'
import type { ScheduleData, TimeBlock, TimeBlockOutcome, VoteData, ActivityType } from './types'
import { ACTIVITY_TYPES, OPPONENT_ACTIVITIES, getBlockActivity } from './types'
import './GridView.scss'

const ROLE_COLORS: Record<string, string> = {
  'Tank': '#00e5ff',
  'Hitscan': '#ff3e8a',
  'Flex DPS': '#ff9f1c',
  'Main Support': '#00ff9f',
  'Flex Support': '#b44dff',
  'DPS': '#ff3e8a',
  'Support': '#00ff9f',
  'Coach': '#94a3b8',
}
const getRoleColor = (role: string) => ROLE_COLORS[role] || '#94a3b8'

interface GridViewProps {
  schedule: ScheduleData
  roles: string[]
  teamMembers: Array<{ id: string; username: string; displayName: string }>
  opponentTeams: Array<{ id: number; name: string }>
  maps: Array<{ id: number; name: string }>
  votes: VoteData[] | null
  discordNameMap: Record<string, string>
  getAssignedPlayerIds: (dayIdx: number, blockIdx: number) => Set<string>
  getPlayerSlotAvailability: (dayDate: string, blockTime: string, playerId: string) => 'available' | 'maybe' | null
  onAssignSlot: (dayIdx: number, blockIdx: number, slotIdx: number, playerId: string | null) => void
  onToggleDay: (dayIdx: number) => void
  onUpdateBlockTime: (dayIdx: number, blockIdx: number, time: string) => void
  onUpdateBlockScrim: (dayIdx: number, blockIdx: number, field: keyof NonNullable<TimeBlock['scrim']>, value: string | boolean | number | null) => void
  onSetBlockActivity: (dayIdx: number, blockIdx: number, activity: string) => void
  onToggleSlotRinger: (dayIdx: number, blockIdx: number, slotIdx: number) => void
  onUpdateRingerName: (dayIdx: number, blockIdx: number, slotIdx: number, name: string, personId?: number) => void
  onMarkBlockReminderPosted: (dayIdx: number, blockIdx: number) => void
  onUpdateBlockOutcome: (dayIdx: number, blockIdx: number, outcome: TimeBlockOutcome | undefined) => void
}

interface DropdownState {
  dayIdx: number
  blockIdx: number
  slotIdx: number
  rowType: 'role' | 'activity'
  rect: { top: number; left: number }
}

export function GridView({
  schedule, roles, teamMembers, opponentTeams, maps, votes, discordNameMap,
  getAssignedPlayerIds, getPlayerSlotAvailability,
  onAssignSlot, onToggleDay, onUpdateBlockTime, onUpdateBlockScrim,
  onSetBlockActivity, onToggleSlotRinger, onUpdateRingerName,
  onMarkBlockReminderPosted, onUpdateBlockOutcome,
}: GridViewProps) {
  const [openDropdown, setOpenDropdown] = useState<DropdownState | null>(null)
  const [scrimModal, setScrimModal] = useState<{ dayIdx: number; blockIdx: number } | null>(null)
  const [outcomeModal, setOutcomeModal] = useState<{ dayIdx: number; blockIdx: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const columns = useMemo(() => {
    const cols: { dayIdx: number; blockIdx: number; date: string; time: string; isFirstOfDay: boolean }[] = []
    schedule.days.forEach((day, dayIdx) => {
      if (!day.enabled) return
      day.blocks.forEach((block, blockIdx) => {
        cols.push({ dayIdx, blockIdx, date: day.date, time: block.time, isFirstOfDay: blockIdx === 0 })
      })
    })
    return cols
  }, [schedule.days])

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

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return ''
    const member = teamMembers.find(m => m.id === playerId)
    if (member) return member.displayName || member.username
    if (discordNameMap[playerId]) return discordNameMap[playerId]
    return playerId
  }

  const getAvailPlayersForDay = (dayDate: string, useAll: boolean) => {
    if (useAll) return teamMembers
    if (!votes) return []
    const day = votes.find(v => v.date === dayDate)
    return day?.voters || []
  }

  if (columns.length === 0) {
    return (
      <div className="se-grid__empty-state">
        Enable some days above to start building the schedule
      </div>
    )
  }

  return (
    <>
      <div className="se-grid-wrapper">
        <table className="se-grid">
          <thead>
            <tr className="se-grid__day-row">
              <th className="se-grid__corner" rowSpan={2}></th>
              {dayGroups.map((group, i) => {
                const day = schedule.days[group.dayIdx]
                const parts = day.date.split(' ')
                const dayName = parts[0] || day.date
                const dateRest = parts.slice(1).join(' ')
                return (
                  <th
                    key={i}
                    className={`se-grid__day-header ${i > 0 ? 'se-grid__day-header--divider' : ''}`}
                    colSpan={group.colSpan}
                  >
                    <label className="se-grid__day-check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={day.enabled} onChange={() => onToggleDay(group.dayIdx)} />
                    </label>
                    <span className="se-grid__day-name">{dayName}</span>
                    <span className="se-grid__day-date">{dateRest}</span>
                  </th>
                )
              })}
            </tr>
            <tr className="se-grid__time-row">
              {columns.map((col, ci) => {
                const block = schedule.days[col.dayIdx].blocks[col.blockIdx]
                return (
                  <th
                    key={ci}
                    className={`se-grid__time-header ${col.isFirstOfDay && ci > 0 ? 'se-grid__time-header--day-start' : ''}`}
                  >
                    <input
                      type="text"
                      className="se-grid__time-input"
                      value={block.time}
                      onChange={e => onUpdateBlockTime(col.dayIdx, col.blockIdx, e.target.value)}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {roles.map(role => {
              const color = getRoleColor(role)
              return (
                <tr key={role} className="se-grid__role-row">
                  <td className="se-grid__role-label" style={{ borderLeftColor: color }}>
                    <span style={{ color }}>{role}</span>
                  </td>
                  {columns.map((col, ci) => {
                    const block = schedule.days[col.dayIdx].blocks[col.blockIdx]
                    const slotIdx = block.slots.findIndex(s => s.role === role)
                    const slot = slotIdx >= 0 ? block.slots[slotIdx] : null

                    if (!slot || slotIdx < 0) {
                      return <td key={ci} className={`se-grid__cell se-grid__cell--na ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`} />
                    }

                    let cellContent: React.ReactNode
                    if (slot.isRinger && slot.ringerName) {
                      cellContent = <span className="se-grid__chip se-grid__chip--ringer">{slot.ringerName} (R)</span>
                    } else if (slot.playerId) {
                      cellContent = <span className="se-grid__chip se-grid__chip--assigned" style={{ borderColor: color }}>{getPlayerName(slot.playerId)}</span>
                    } else {
                      cellContent = <span className="se-grid__empty-cell">-</span>
                    }

                    return (
                      <td
                        key={ci}
                        className={`se-grid__cell ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`}
                        onClick={e => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setOpenDropdown({ dayIdx: col.dayIdx, blockIdx: col.blockIdx, slotIdx, rowType: 'role', rect: { top: r.bottom, left: r.left + r.width / 2 } })
                        }}
                      >
                        {cellContent}
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            <tr className="se-grid__meta-row se-grid__meta-row--separator">
              <td className="se-grid__role-label se-grid__role-label--meta"><span>Activity</span></td>
              {columns.map((col, ci) => {
                const block = schedule.days[col.dayIdx].blocks[col.blockIdx]
                const activity = getBlockActivity(block)
                const activityLabel = ACTIVITY_TYPES.find(a => a.value === activity)?.label || activity
                return (
                  <td
                    key={ci}
                    className={`se-grid__cell se-grid__cell--meta ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`}
                    onClick={e => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setOpenDropdown({ dayIdx: col.dayIdx, blockIdx: col.blockIdx, slotIdx: -1, rowType: 'activity', rect: { top: r.bottom, left: r.left + r.width / 2 } })
                    }}
                  >
                    <span className={`se-grid__activity se-grid__activity--${activity}`}>
                      {activityLabel}
                    </span>
                  </td>
                )
              })}
            </tr>

            <tr className="se-grid__meta-row">
              <td className="se-grid__role-label se-grid__role-label--meta"><span>Opponent</span></td>
              {columns.map((col, ci) => {
                const block = schedule.days[col.dayIdx].blocks[col.blockIdx]
                const isOpponentBlock = OPPONENT_ACTIVITIES.has(getBlockActivity(block))
                if (!isOpponentBlock) {
                  return <td key={ci} className={`se-grid__cell se-grid__cell--meta ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`} />
                }
                const opponentName = block.scrim?.opponent || ''
                return (
                  <td
                    key={ci}
                    className={`se-grid__cell se-grid__cell--meta se-grid__cell--clickable ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`}
                    onClick={() => setScrimModal({ dayIdx: col.dayIdx, blockIdx: col.blockIdx })}
                  >
                    {opponentName ? (
                      <span className="se-grid__opponent">{opponentName}</span>
                    ) : (
                      <span className="se-grid__empty-cell se-grid__empty-cell--tbd">TBD</span>
                    )}
                  </td>
                )
              })}
            </tr>

            <tr className="se-grid__meta-row">
              <td className="se-grid__role-label se-grid__role-label--meta"><span>Outcome</span></td>
              {columns.map((col, ci) => {
                const block = schedule.days[col.dayIdx].blocks[col.blockIdx]
                if (!OPPONENT_ACTIVITIES.has(getBlockActivity(block))) {
                  return <td key={ci} className={`se-grid__cell se-grid__cell--meta ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`} />
                }
                const hasOutcome = !!(block.outcome?.ourRating || block.outcome?.opponentRating || block.outcome?.worthScrimAgain)
                const label = hasOutcome
                  ? ({ easywin: 'Easy W', closewin: 'Close W', neutral: 'Neutral', closeloss: 'Close L', gotrolled: 'Rolled' } as Record<string, string>)[block.outcome?.ourRating || ''] || 'Logged'
                  : null
                return (
                  <td
                    key={ci}
                    className={`se-grid__cell se-grid__cell--meta se-grid__cell--clickable ${col.isFirstOfDay && ci > 0 ? 'se-grid__cell--day-start' : ''}`}
                    onClick={() => setOutcomeModal({ dayIdx: col.dayIdx, blockIdx: col.blockIdx })}
                  >
                    {hasOutcome ? (
                      <span className="se-grid__activity se-grid__activity--outcome">{label}</span>
                    ) : (
                      <span className="se-grid__empty-cell se-grid__empty-cell--clickable">+ outcome</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {openDropdown && (
        <div className="se-grid__dropdown-overlay" onClick={() => setOpenDropdown(null)}>
          <div
            ref={dropdownRef}
            className="se-grid__dropdown"
            style={{ top: openDropdown.rect.top, left: openDropdown.rect.left }}
            onClick={e => e.stopPropagation()}
          >
            {openDropdown.rowType === 'role' && (() => {
              const day = schedule.days[openDropdown.dayIdx]
              const block = day?.blocks[openDropdown.blockIdx]
              const slot = block?.slots[openDropdown.slotIdx]
              if (!slot) return null
              const assignedIds = getAssignedPlayerIds(openDropdown.dayIdx, openDropdown.blockIdx)
              const rawPlayers = getAvailPlayersForDay(day.date, day.useAllMembers || false)
              const players = rawPlayers.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
              const filtered = players.filter(p => !assignedIds.has(p.id) || p.id === slot.playerId)

              return (
                <div className="se-grid__dropdown-scroll">
                  {(slot.playerId || slot.isRinger) && (
                    <button
                      className="se-grid__dropdown-item se-grid__dropdown-item--clear"
                      onClick={() => { onAssignSlot(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, null); setOpenDropdown(null) }}
                    >Clear</button>
                  )}
                  {filtered.map(player => {
                    const isActive = player.id === slot.playerId
                    const avail = getPlayerSlotAvailability(day.date, block.time, player.id)
                    return (
                      <button
                        key={player.id}
                        className={`se-grid__dropdown-item ${isActive ? 'se-grid__dropdown-item--active' : ''}`}
                        onClick={() => { onAssignSlot(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx, player.id); setOpenDropdown(null) }}
                      >
                        {avail === 'available' && <span className="se-grid__avail-dot" />}
                        {avail === 'maybe' && <span className="se-grid__avail-dot se-grid__avail-dot--maybe" />}
                        {player.displayName || player.username}
                      </button>
                    )
                  })}
                  <div className="se-grid__dropdown-divider" />
                  <button
                    className="se-grid__dropdown-item se-grid__dropdown-item--ringer"
                    onClick={() => { onToggleSlotRinger(openDropdown.dayIdx, openDropdown.blockIdx, openDropdown.slotIdx); setOpenDropdown(null) }}
                  >
                    {slot.isRinger ? 'Switch to Player' : 'Mark as Ringer'}
                  </button>
                </div>
              )
            })()}
            {openDropdown.rowType === 'activity' && (() => {
              const block = schedule.days[openDropdown.dayIdx]?.blocks[openDropdown.blockIdx]
              if (!block) return null
              const currentActivity = getBlockActivity(block)
              return (
                <>
                  {ACTIVITY_TYPES.map(opt => (
                    <button
                      key={opt.value}
                      className={`se-grid__dropdown-item ${currentActivity === opt.value ? 'se-grid__dropdown-item--active' : ''}`}
                      onClick={() => { onSetBlockActivity(openDropdown.dayIdx, openDropdown.blockIdx, opt.value); setOpenDropdown(null) }}
                    >{opt.label}</button>
                  ))}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {scrimModal && (() => {
        const day = schedule.days[scrimModal.dayIdx]
        const block = day?.blocks[scrimModal.blockIdx]
        if (!block) return null
        const scrim = block.scrim || { opponent: '', opponentRoster: '', contact: '', host: '' as const, mapPool: '', heroBans: true, staggers: false, notes: '' }
        const dayName = (day.date.split(' ')[0]) || day.date

        return (
          <div className="se-grid__modal-overlay" onClick={() => setScrimModal(null)}>
            <div className="se-grid__scrim-modal" onClick={e => e.stopPropagation()}>
              <div className="se-grid__scrim-modal-header">
                <h3>Scrim Details</h3>
                <span>{dayName} {block.time}</span>
                <button type="button" onClick={() => setScrimModal(null)}><X size={16} /></button>
              </div>
              <div className="se-grid__scrim-modal-body">
                <div className="se-grid__scrim-field">
                  <label>Opponent:</label>
                  <div className="se-grid__autocomplete">
                    <input
                      type="text"
                      placeholder="Search or type team name..."
                      value={scrim.opponent || ''}
                      onChange={e => {
                        onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'opponent', e.target.value)
                        if (scrim.opponentTeamId) {
                          const t = opponentTeams.find(t => t.id === scrim.opponentTeamId)
                          if (t && t.name !== e.target.value) {
                            onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'opponentTeamId', null)
                          }
                        }
                      }}
                    />
                    {scrim.opponent && !scrim.opponentTeamId && opponentTeams.filter(t =>
                      t.name.toLowerCase().includes((scrim.opponent || '').toLowerCase())
                    ).length > 0 && (
                      <div className="se-grid__autocomplete-list">
                        {opponentTeams
                          .filter(t => t.name.toLowerCase().includes((scrim.opponent || '').toLowerCase()))
                          .slice(0, 8)
                          .map(team => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'opponentTeamId', team.id)
                                onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'opponent', team.name)
                              }}
                            >{team.name}</button>
                          ))}
                      </div>
                    )}
                    {scrim.opponentTeamId && <span className="se-grid__linked">Linked</span>}
                  </div>
                </div>
                <div className="se-grid__scrim-field">
                  <label>Contact:</label>
                  <input type="text" placeholder="e.g., Username#1234" value={scrim.contact || ''} onChange={e => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'contact', e.target.value)} />
                </div>
                <div className="se-grid__scrim-field">
                  <label>Host:</label>
                  <div className="se-grid__toggle-row">
                    <button type="button" className={`se-grid__toggle ${scrim.host === 'us' ? 'se-grid__toggle--active' : ''}`} onClick={() => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'host', scrim.host === 'us' ? '' : 'us')}>Us</button>
                    <button type="button" className={`se-grid__toggle ${scrim.host === 'them' ? 'se-grid__toggle--active' : ''}`} onClick={() => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'host', scrim.host === 'them' ? '' : 'them')}>Them</button>
                  </div>
                </div>
                <div className="se-grid__scrim-field">
                  <label>Map Pool:</label>
                  <input type="text" placeholder="e.g., Faceit" value={scrim.mapPool || ''} onChange={e => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'mapPool', e.target.value)} />
                </div>
                <div className="se-grid__scrim-field">
                  <label>Rules:</label>
                  <div className="se-grid__toggle-row">
                    <button type="button" className={`se-grid__toggle ${(scrim.heroBans ?? true) ? 'se-grid__toggle--active' : ''}`} onClick={() => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'heroBans', !(scrim.heroBans ?? true))}>Hero Bans</button>
                    <button type="button" className={`se-grid__toggle ${scrim.staggers ? 'se-grid__toggle--active' : ''}`} onClick={() => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'staggers', !scrim.staggers)}>Staggers</button>
                  </div>
                </div>
                <div className="se-grid__scrim-field se-grid__scrim-field--full">
                  <label>Opponent Roster:</label>
                  <textarea placeholder="Paste opponent roster here..." rows={3} value={scrim.opponentRoster || ''} onChange={e => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'opponentRoster', e.target.value)} />
                </div>
                <div className="se-grid__scrim-field se-grid__scrim-field--full">
                  <label>Notes:</label>
                  <input type="text" placeholder="Any additional notes..." value={scrim.notes || ''} onChange={e => onUpdateBlockScrim(scrimModal.dayIdx, scrimModal.blockIdx, 'notes', e.target.value)} />
                </div>
                <div className="se-grid__scrim-actions">
                  <ReminderButton
                    dayDate={day.date}
                    blockTime={block.time}
                    hasOpponent={Boolean(scrim.opponent)}
                    reminderPosted={block.reminderPosted}
                    onReminderPosted={() => onMarkBlockReminderPosted(scrimModal.dayIdx, scrimModal.blockIdx)}
                  />
                  <ScrimOutcomeButton
                    opponentName={scrim.opponent || ''}
                    outcome={block.outcome}
                    onSaveOutcome={outcome => onUpdateBlockOutcome(scrimModal.dayIdx, scrimModal.blockIdx, outcome)}
                    availableMaps={maps}
                  />
                </div>
              </div>
              <div className="se-grid__scrim-modal-footer">
                <button type="button" onClick={() => setScrimModal(null)}>Done</button>
              </div>
            </div>
          </div>
        )
      })()}

      {outcomeModal && (() => {
        const block = schedule.days[outcomeModal.dayIdx]?.blocks[outcomeModal.blockIdx]
        if (!block) return null
        const outcome = block.outcome || {} as TimeBlockOutcome
        const day = schedule.days[outcomeModal.dayIdx]
        const opponentName = block.scrim?.opponent || opponentTeams.find(t => t.id === block.scrim?.opponentTeamId)?.name || 'Unknown'

        const ourOptions = [
          { value: 'easywin', label: 'Easy Win' },
          { value: 'closewin', label: 'Close Win' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'closeloss', label: 'Close Loss' },
          { value: 'gotrolled', label: 'Got Rolled' },
        ]
        const theirOptions = [
          { value: 'weak', label: 'Weak' },
          { value: 'average', label: 'Average' },
          { value: 'strong', label: 'Strong' },
          { value: 'verystrong', label: 'Very Strong' },
        ]
        const againOptions = [
          { value: 'yes', label: 'Yes' },
          { value: 'maybe', label: 'Maybe' },
          { value: 'no', label: 'No' },
        ]

        return (
          <div className="se-grid__modal-overlay" onClick={() => setOutcomeModal(null)}>
            <div className="se-grid__scrim-modal" onClick={e => e.stopPropagation()}>
              <div className="se-grid__scrim-modal-header">
                <h3>Scrim Outcome</h3>
                <span>vs {opponentName} - {day.date} {block.time}</span>
                <button onClick={() => setOutcomeModal(null)}><X size={16} /></button>
              </div>
              <div className="se-grid__scrim-modal-body">
                <div className="se-grid__scrim-field">
                  <label>Our Performance</label>
                  <div className="se-grid__toggle-row" style={{ flexWrap: 'wrap' }}>
                    {ourOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`se-grid__toggle ${outcome.ourRating === opt.value ? 'se-grid__toggle--active' : ''}`}
                        onClick={() => onUpdateBlockOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                          ...outcome,
                          ourRating: outcome.ourRating === opt.value ? undefined : opt.value as any,
                        })}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div className="se-grid__scrim-field">
                  <label>Opponent Strength</label>
                  <div className="se-grid__toggle-row" style={{ flexWrap: 'wrap' }}>
                    {theirOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`se-grid__toggle ${outcome.opponentRating === opt.value ? 'se-grid__toggle--active' : ''}`}
                        onClick={() => onUpdateBlockOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                          ...outcome,
                          opponentRating: outcome.opponentRating === opt.value ? undefined : opt.value as any,
                        })}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div className="se-grid__scrim-field">
                  <label>Worth Scrimming Again?</label>
                  <div className="se-grid__toggle-row">
                    {againOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`se-grid__toggle ${outcome.worthScrimAgain === opt.value ? 'se-grid__toggle--active' : ''}`}
                        onClick={() => onUpdateBlockOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                          ...outcome,
                          worthScrimAgain: outcome.worthScrimAgain === opt.value ? undefined : opt.value as any,
                        })}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div className="se-grid__scrim-field se-grid__scrim-field--full">
                  <label>Notes</label>
                  <textarea
                    placeholder="Post-scrim thoughts, areas to improve..."
                    rows={3}
                    value={outcome.scrimNotes || ''}
                    onChange={e => onUpdateBlockOutcome(outcomeModal.dayIdx, outcomeModal.blockIdx, {
                      ...outcome,
                      scrimNotes: e.target.value,
                    })}
                  />
                </div>
              </div>
              <div className="se-grid__scrim-modal-footer">
                <button type="button" onClick={() => setOutcomeModal(null)}>Done</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
