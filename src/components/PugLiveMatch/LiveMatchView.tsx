'use client'
import { useEffect, useRef, useState } from 'react'
import type { LiveSnapshot, LiveActivityEvent, LiveLeaders } from './types'
import { diffSnapshots } from './diffSnapshots'
import { LiveSummary } from './LiveSummary'
import { LiveScoreboard } from './LiveScoreboard'
import { LiveActivityTicker } from './LiveActivityTicker'

const POLL_MS = 3000
const MAX_ACTIVITY = 12

export function LiveMatchView({ lobbyId, botStatus }: { lobbyId: number; botStatus: string | null }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null)
  const [changed, setChanged] = useState<Set<string>>(new Set())
  const [leaders, setLeaders] = useState<LiveLeaders>({ elims: null, damage: null, healing: null })
  const [activity, setActivity] = useState<LiveActivityEvent[]>([])
  const [displayTime, setDisplayTime] = useState(0)
  const prevRef = useRef<LiveSnapshot | null>(null)

  const live = botStatus != null && ['game_started', 'players_joining'].includes(botStatus)

  useEffect(() => {
    if (!live) return
    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/pug/lobby/${lobbyId}/live-stats`)
        if (!res.ok || !active) return
        const { liveStats } = await res.json()
        if (!liveStats || !active) return
        const d = diffSnapshots(prevRef.current, liveStats as LiveSnapshot)
        prevRef.current = liveStats
        setSnapshot(liveStats)
        setChanged(d.changed)
        setLeaders(d.leaders)
        setDisplayTime((liveStats as LiveSnapshot).matchTime)
        if (d.activity.length) setActivity((a) => [...d.activity.reverse(), ...a].slice(0, MAX_ACTIVITY))
      } catch { /* keep last snapshot */ }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { active = false; clearInterval(id) }
  }, [lobbyId, live])

  useEffect(() => {
    if (!snapshot || snapshot.matchEnded) return
    const id = setInterval(() => setDisplayTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [snapshot])

  if (!live || !snapshot || snapshot.eventCount === 0) return null
  const empty = Object.keys(snapshot.team1.players).length === 0 && Object.keys(snapshot.team2.players).length === 0
  if (empty) return null

  return (
    <div className="scrim-detail">
      <LiveSummary snapshot={snapshot} displayMatchTime={displayTime} />
      <LiveScoreboard snapshot={snapshot} changed={changed} leaders={leaders} />
      <LiveActivityTicker events={activity} />
    </div>
  )
}
