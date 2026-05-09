'use client'

import React, { useMemo } from 'react'
import { Users, Swords, Trophy } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import { ACTIVITY_TYPES, OPPONENT_ACTIVITIES, getBlockActivity } from '@/components/ScheduleEditor/types'
import './WeekDetail.css'

const OUTCOME_LABELS: Record<string, string> = {
  easywin: 'Easy Win',
  closewin: 'Close Win',
  neutral: 'Neutral',
  closeloss: 'Close Loss',
  gotrolled: 'Got Rolled',
}

const OPPONENT_RATING_LABELS: Record<string, string> = {
  weak: 'Weak',
  average: 'Average',
  strong: 'Strong',
  verystrong: 'Very Strong',
}

interface WeekDetailProps {
  weekStart: Date
}

export function WeekDetail({ weekStart }: WeekDetailProps) {
  const { data } = useSchedule()
  const { recentSchedules, team } = data

  const playerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of [...team.roster, ...team.subs]) {
      if (entry.person) {
        map[String(entry.person.id)] = entry.person.name || 'Unknown'
        if (entry.person.discordId) {
          map[entry.person.discordId] = entry.person.name || 'Unknown'
        }
      }
    }
    return map
  }, [team.roster, team.subs])

  const matchingSchedule = useMemo(() => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    return (recentSchedules as any[]).find(s => {
      if (!s.dateRange?.start || !s.dateRange?.end) return false
      const schedStart = s.dateRange.start.split('T')[0]
      const schedEnd = s.dateRange.end.split('T')[0]
      return schedStart <= weekEndStr && schedEnd >= weekStartStr
    }) || null
  }, [recentSchedules, weekStart])

  if (!matchingSchedule) {
    return (
      <div className="week-detail week-detail--empty">
        <p>No schedule data for this week.</p>
      </div>
    )
  }

  const schedule = matchingSchedule.schedule
  const responses = matchingSchedule.responses || []
  const votes = matchingSchedule.votes || []
  const days = schedule?.days || []
  const enabledDays = days.filter((d: any) => d.enabled)
  const responseCount = responses.length || (votes.length > 0 ? new Set(votes.flatMap((v: any) => (v.voters || []).map((p: any) => p.id))).size : 0)

  return (
    <div className="week-detail">
      <div className="week-detail__summary">
        <span className="week-detail__stat">
          <Users size={14} />
          {responseCount} response{responseCount !== 1 ? 's' : ''}
        </span>
        <span className="week-detail__stat">
          <Swords size={14} />
          {enabledDays.length} day{enabledDays.length !== 1 ? 's' : ''} scheduled
        </span>
      </div>

      {enabledDays.length === 0 ? (
        <p className="week-detail__no-days">No days enabled for this week.</p>
      ) : (
        enabledDays.map((day: any, di: number) => (
          <div key={di} className="week-detail__day">
            <h4 className="week-detail__day-title">{day.date}</h4>
            {(day.blocks || []).map((block: any, bi: number) => {
              const activity = getBlockActivity(block)
              const activityLabel = ACTIVITY_TYPES.find(a => a.value === activity)?.label || activity
              const isOpponentBlock = OPPONENT_ACTIVITIES.has(activity)
              const outcome = block.outcome
              return (
                <div key={bi} className="week-detail__block">
                  <div className="week-detail__block-header">
                    <span className="week-detail__block-time">{block.time}</span>
                    <span className={`week-detail__activity week-detail__activity--${activity}`}>{activityLabel}</span>
                    {isOpponentBlock && block.scrim?.opponent && (
                      <span className="week-detail__block-opponent">
                        <Swords size={12} />
                        vs {typeof block.scrim.opponent === 'object' ? block.scrim.opponent.name : block.scrim.opponent}
                      </span>
                    )}
                    {outcome?.ourRating && (
                      <span className={`week-detail__outcome week-detail__outcome--${outcome.ourRating}`}>
                        <Trophy size={12} />
                        {OUTCOME_LABELS[outcome.ourRating] || outcome.ourRating}
                      </span>
                    )}
                  </div>
                  {outcome && (outcome.opponentRating || outcome.worthScrimAgain || outcome.scrimNotes) && (
                    <div className="week-detail__outcome-detail">
                      {outcome.opponentRating && (
                        <span className="week-detail__outcome-tag">Opponent: {OPPONENT_RATING_LABELS[outcome.opponentRating] || outcome.opponentRating}</span>
                      )}
                      {outcome.worthScrimAgain && (
                        <span className={`week-detail__outcome-tag week-detail__outcome-tag--again-${outcome.worthScrimAgain}`}>
                          Again: {outcome.worthScrimAgain === 'yes' ? 'Yes' : outcome.worthScrimAgain === 'maybe' ? 'Maybe' : 'No'}
                        </span>
                      )}
                      {outcome.scrimNotes && (
                        <span className="week-detail__outcome-notes">{outcome.scrimNotes}</span>
                      )}
                    </div>
                  )}
                  <div className="week-detail__slots">
                    {(block.slots || []).map((slot: any, si: number) => (
                      <span key={si} className="week-detail__slot">
                        <span className="week-detail__slot-role">{slot.role}:</span>
                        <span className="week-detail__slot-player">
                          {slot.isRinger ? slot.ringerName : (slot.playerId ? playerNameMap[String(slot.playerId)] || 'Unknown' : '-')}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
