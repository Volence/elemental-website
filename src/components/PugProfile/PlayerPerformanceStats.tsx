'use client'

import { useEffect, useState } from 'react'

interface Season {
  id: number
  name: string
  tier: string
}

interface HeroStat {
  hero: string
  timePlayed: number
  games: number
  eliminations: number
  deaths: number
  damage: number
  healing: number
}

interface Stats {
  games: number
  totals: {
    eliminations: number
    finalBlows: number
    deaths: number
    damage: number
    heroDamage: number
    healing: number
    blocked: number
    ultsEarned: number
    ultsUsed: number
  }
  averages: {
    eliminations: number
    finalBlows: number
    deaths: number
    damage: number
    heroDamage: number
    healing: number
    blocked: number
    ultsEarned: number
    ultsUsed: number
  }
  kdRatio: number
  heroes: HeroStat[]
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function PlayerPerformanceStats({
  playerId,
  seasons,
}: {
  playerId: number
  seasons: Season[]
}) {
  const [mode, setMode] = useState<'all' | 'season'>('all')
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(
    seasons[0]?.id ?? null,
  )
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url =
      mode === 'all'
        ? `/api/pug/profile/${playerId}/stats`
        : `/api/pug/profile/${playerId}/stats?seasonId=${selectedSeasonId}`

    fetch(url)
      .then((r) => r.json())
      .then((data) => setStats(data.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [playerId, mode, selectedSeasonId])

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Performance Stats</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('all')}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              mode === 'all'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            All Time
          </button>
          {seasons.length > 0 && (
            <div className="relative">
              <select
                value={mode === 'season' ? selectedSeasonId ?? '' : ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val)) {
                    setMode('season')
                    setSelectedSeasonId(val)
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium appearance-none pr-7 bg-gray-800/50 transition-colors cursor-pointer ${
                  mode === 'season'
                    ? 'border-blue-500/40 text-blue-300'
                    : 'border-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                <option value="" disabled>
                  Season
                </option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 border border-gray-800 rounded-xl bg-gray-900/30">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : !stats ? (
        <div className="text-center py-12 border border-gray-800 rounded-xl bg-gray-900/30">
          <p className="text-gray-400">No match data available.</p>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl bg-gray-900/30 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-gray-400">
                {stats.games} game{stats.games !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-gray-600">|</span>
              <span className="text-sm font-medium text-gray-200">
                {stats.kdRatio} K/D
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <StatBox label="Avg Elims" value={stats.averages.eliminations} />
              <StatBox
                label="Avg Final Blows"
                value={stats.averages.finalBlows}
              />
              <StatBox label="Avg Deaths" value={stats.averages.deaths} />
              <StatBox
                label="Avg Damage"
                value={fmtNum(stats.averages.damage)}
              />
              <StatBox
                label="Avg Hero Dmg"
                value={fmtNum(stats.averages.heroDamage)}
              />
              <StatBox
                label="Avg Healing"
                value={fmtNum(stats.averages.healing)}
              />
              <StatBox
                label="Avg Mitigated"
                value={fmtNum(stats.averages.blocked)}
              />
              <StatBox
                label="Avg Ults"
                value={stats.averages.ultsEarned}
              />
            </div>
          </div>

          {stats.heroes.length > 0 && (
            <>
              <div className="border-t border-gray-800/60 px-5 py-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Hero Pool
                </span>
              </div>
              <div className="px-5 pb-4">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-1 text-xs">
                  <span className="text-gray-600 font-medium">Hero</span>
                  <span className="text-gray-600 font-medium text-right">
                    Time
                  </span>
                  <span className="text-gray-600 font-medium text-right">
                    K
                  </span>
                  <span className="text-gray-600 font-medium text-right">
                    D
                  </span>
                  <span className="text-gray-600 font-medium text-right">
                    Dmg
                  </span>
                  {stats.heroes.slice(0, 8).map((h) => (
                    <HeroRow key={h.hero} hero={h} />
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 opacity-40" />
        </div>
      )}
    </div>
  )
}

function StatBox({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-gray-800/40 rounded-lg px-3 py-2.5">
      <div className="text-lg font-bold text-gray-100">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  )
}

function HeroRow({ hero }: { hero: HeroStat }) {
  return (
    <>
      <span className="text-gray-200 font-medium truncate py-1">
        {hero.hero}
      </span>
      <span className="text-gray-400 text-right tabular-nums py-1">
        {fmtTime(hero.timePlayed)}
      </span>
      <span className="text-gray-300 text-right tabular-nums py-1">
        {hero.eliminations}
      </span>
      <span className="text-gray-300 text-right tabular-nums py-1">
        {hero.deaths}
      </span>
      <span className="text-gray-300 text-right tabular-nums py-1">
        {fmtNum(Math.round(hero.damage))}
      </span>
    </>
  )
}
