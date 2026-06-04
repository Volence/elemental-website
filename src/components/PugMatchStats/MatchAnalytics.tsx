'use client'

import { useState, useEffect } from 'react'
import type { RoleMatchup, PlayerLine } from './types'
import { MatchSummary } from './MatchSummary'
import { Matchups } from './Matchups'
import { PlayerStatsTable } from '@/components/MatchStats/PlayerStatsTable'
import { pickStandout } from '@/components/MatchStats/standout'
import KillfeedTab from '@/components/ScrimMapDetail/KillfeedTab'
import EventsTab from '@/components/ScrimMapDetail/EventsTab'
import CompareTab from '@/components/ScrimMapDetail/CompareTab'
import type { PlayerRow, OverviewTeams } from '@/components/MatchStats/types'

type OverviewData = {
  mapName: string
  mapType: string
  teams: OverviewTeams
  summary: {
    matchTime: number
    score: string
    scoreOverride: string | null
    canEditScore: boolean
    team1Damage: number
    team2Damage: number
    team1Healing: number
    team2Healing: number
  }
  players: PlayerRow[]
}

const TABS = ['Scoreboard', 'Killfeed', 'Events', 'Compare', 'Matchups'] as const
type TabLabel = (typeof TABS)[number]

export function MatchAnalytics({
  mapDataId,
  lobbyNumber,
  mapName,
  matchups,
  unpaired,
}: {
  mapDataId: number
  lobbyNumber: number
  mapName: string
  matchups: RoleMatchup[]
  unpaired: PlayerLine[]
}) {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activeTab, setActiveTab] = useState<TabLabel>('Scoreboard')

  useEffect(() => {
    fetch(`/api/scrim-stats?mapId=${mapDataId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setOverview(d)
      })
      .catch(() => {/* silently fail - overview stays null */})
  }, [mapDataId])

  // Derive score from the "X - Y" string, mirroring how ScrimMapDetail/index.tsx does it
  const [s1, s2] = overview
    ? overview.summary.score.split(' - ').map(Number)
    : [0, 0]
  const team1Won = s1 > s2
  const team2Won = s2 > s1
  const result: 'team1' | 'team2' | 'draw' = team1Won ? 'team1' : team2Won ? 'team2' : 'draw'

  const standout = overview ? pickStandout(overview.players ?? []) : null

  const mapIdStr = String(mapDataId)

  return (
    <div>
      {/* Summary - shown once overview loads */}
      {overview ? (
        <MatchSummary
          lobbyNumber={lobbyNumber}
          mapName={mapName}
          durationSec={overview.summary.matchTime}
          team1Score={s1}
          team2Score={s2}
          result={result}
          standout={standout}
        />
      ) : (
        <div className="scrim-detail__summary-card" style={{ marginBottom: '20px', opacity: 0.5 }}>
          <div className="scrim-detail__summary-label">Loading match summary...</div>
        </div>
      )}

      {/* Tab bar */}
      <div className="scrim-detail__tabs">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`scrim-detail__tab${activeTab === t ? ' scrim-detail__tab--active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Scoreboard tab */}
      {activeTab === 'Scoreboard' && (
        overview ? (
          <PlayerStatsTable
            teams={overview.teams}
            players={overview.players ?? []}
            team1Won={team1Won}
            team2Won={team2Won}
            readOnly
          />
        ) : (
          <div className="scrim-detail__summary-card" style={{ opacity: 0.5, marginTop: '16px' }}>
            <div className="scrim-detail__summary-label">Loading scoreboard...</div>
          </div>
        )
      )}

      {/* Killfeed tab */}
      {activeTab === 'Killfeed' && <KillfeedTab mapId={mapIdStr} />}

      {/* Events tab */}
      {activeTab === 'Events' && <EventsTab mapId={mapIdStr} />}

      {/* Compare tab */}
      {activeTab === 'Compare' && <CompareTab mapId={mapIdStr} />}

      {/* Matchups tab */}
      {activeTab === 'Matchups' && (
        <Matchups matchups={matchups} unpaired={unpaired} />
      )}
    </div>
  )
}
