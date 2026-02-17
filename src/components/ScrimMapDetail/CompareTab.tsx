'use client'

import React, { useState, useEffect } from 'react'

const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'
const BG_CARD = 'rgba(15, 23, 42, 0.6)'
const BORDER = 'rgba(148, 163, 184, 0.08)'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  borderRadius: '12px',
  padding: '20px 24px',
  border: `1px solid ${BORDER}`,
}

type ComparePlayer = {
  name: string
  team: string
  hero: string
  eliminations: number
  deaths: number
  finalBlows: number
  heroDamage: number
  healingDealt: number
  damageTaken: number
  damageBlocked: number
  assists: number
  timePlayed: number
  ultimatesEarned: number
  ultimatesUsed: number
  soloKills: number
  objectiveKills: number
  criticalHits: number
  weaponAccuracy: number
}

type CompareData = {
  teams: { team1: string; team2: string }
  team1Players: ComparePlayer[]
  team2Players: ComparePlayer[]
}

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n))
}

function toTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function StatBar({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
        <span style={{ color: TEXT_DIM }}>{label}</span>
        <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{typeof value === 'number' && value >= 1000 ? formatNumber(value) : value}</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function CompareTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/scrim-stats?mapId=${mapId}&tab=compare`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading comparison…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load compare data</div>

  // Find max values across all players for consistent bar scaling
  const allPlayers = [...data.team1Players, ...data.team2Players]
  const maxElims = Math.max(...allPlayers.map(p => p.eliminations), 1)
  const maxDeaths = Math.max(...allPlayers.map(p => p.deaths), 1)
  const maxDamage = Math.max(...allPlayers.map(p => p.heroDamage), 1)
  const maxHealing = Math.max(...allPlayers.map(p => p.healingDealt), 1)

  const renderPlayerCard = (player: ComparePlayer, color: string, index: number) => (
    <div key={`${player.name}-${player.hero}-${index}`} style={{
      ...CARD_STYLE,
      padding: '16px 20px',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', color: TEXT_PRIMARY }}>{player.name}</div>
        <div style={{ fontSize: '12px', color: TEXT_SECONDARY, marginTop: '2px' }}>
          {player.hero} · {toTimestamp(player.timePlayed)}
        </div>
      </div>

      <StatBar label="Eliminations" value={player.eliminations} maxValue={maxElims} color={color} />
      <StatBar label="Deaths" value={player.deaths} maxValue={maxDeaths} color={RED} />
      <StatBar label="Hero Damage" value={player.heroDamage} maxValue={maxDamage} color={color} />
      <StatBar label="Healing Dealt" value={player.healingDealt} maxValue={maxHealing} color={GREEN} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>{player.finalBlows}</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Final Blows</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>{player.soloKills}</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Solo Kills</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>{player.assists}</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assists</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>{player.ultimatesUsed}</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ults Used</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>{player.criticalHits}</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Crits</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>{(player.weaponAccuracy).toFixed(0)}%</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accuracy</div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Team 1 */}
      <div>
        <div style={{
          fontWeight: 700,
          fontSize: '16px',
          color: GREEN,
          marginBottom: '14px',
          paddingBottom: '8px',
          borderBottom: `2px solid ${GREEN}`,
        }}>
          {data.teams.team1}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.team1Players.map((p, i) => renderPlayerCard(p, CYAN, i))}
        </div>
      </div>

      {/* Team 2 */}
      <div>
        <div style={{
          fontWeight: 700,
          fontSize: '16px',
          color: RED,
          marginBottom: '14px',
          paddingBottom: '8px',
          borderBottom: `2px solid ${RED}`,
        }}>
          {data.teams.team2}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.team2Players.map((p, i) => renderPlayerCard(p, RED, i))}
        </div>
      </div>
    </div>
  )
}
