'use client'
import { useState } from 'react'
import type { MatchStats } from './types'
import { MatchSummary } from './MatchSummary'
import { Scoreboard } from './Scoreboard'
import { HeroBreakdown } from './HeroBreakdown'
import { Matchups } from './Matchups'
import { MatchTimeline } from './MatchTimeline'

const TABS = ['Scoreboard', 'Heroes', 'Matchups', 'Timeline'] as const

export function MatchAnalytics({ data }: { data: MatchStats }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Scoreboard')
  return (
    <div>
      <MatchSummary s={data.summary} />
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Scoreboard' && <Scoreboard players={data.players} />}
      {tab === 'Heroes' && <HeroBreakdown players={data.players} heroSwaps={data.heroSwaps} />}
      {tab === 'Matchups' && <Matchups matchups={data.matchups} unpaired={data.unpaired} />}
      {tab === 'Timeline' && <MatchTimeline kills={data.kills} ults={data.ults} />}
    </div>
  )
}
