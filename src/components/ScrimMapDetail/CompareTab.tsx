'use client'

import React, { useState, useEffect } from 'react'
import { getHeroIconUrl, loadHeroPortraits } from '@/lib/scrim-parser/heroIcons'

// ── Clean Glow Design Tokens ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'
const BORDER_SUBTLE = 'rgba(148, 163, 184, 0.06)'

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

function formatMinutes(seconds: number): string {
  return (seconds / 60).toFixed(2)
}

function per10(value: number, timePlayed: number): string {
  if (timePlayed <= 0) return '0'
  return ((value / timePlayed) * 600).toFixed(2)
}

function formatBigNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(n % 1 !== 0 ? 2 : 0)
}

// ── Hero Portrait ──
function HeroPortrait({ hero, teamColor }: { hero: string; teamColor: string }) {
  const [failed, setFailed] = useState(false)
  const url = getHeroIconUrl(hero)
  const size = 120

  if (failed || !url) {
    return (
      <div
        title={hero}
        style={{
          width: size,
          height: size,
          borderRadius: '8px',
          border: `2px solid ${teamColor}`,
          boxShadow: `0 0 12px ${teamColor}44, inset 0 0 20px rgba(0,0,0,0.3)`,
          background: `${teamColor}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          fontWeight: 700,
          color: teamColor,
        }}
      >
        {hero.charAt(0)}
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '8px',
        border: `2px solid ${teamColor}`,
        boxShadow: `0 0 12px ${teamColor}44`,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={url}
        alt={hero}
        title={hero}
        width={size - 4}
        height={size - 4}
        onError={() => setFailed(true)}
        style={{ objectFit: 'cover', display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}

// ── Stat Card ──
function StatCard({
  label,
  value,
  sub,
  accentColor,
  icon,
}: {
  label: string
  value: string | number
  sub: string
  accentColor: string
  icon?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(4px)',
        borderRadius: '8px',
        border: `1px solid ${BORDER_SUBTLE}`,
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${accentColor}06`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)')}
    >
      {/* Left accent */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '2px',
          background: accentColor,
          boxShadow: `0 0 6px ${accentColor}44`,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: '14px', opacity: 0.6 }}>{icon}</span>}
      </div>
      <div
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: TEXT_PRIMARY,
          lineHeight: 1,
          marginBottom: '6px',
          textShadow: `0 0 12px ${accentColor}22`,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '11px', color: TEXT_DIM, lineHeight: 1.3 }}>{sub}</div>
    </div>
  )
}

// ── Player Tab Button ──
function PlayerTab({
  name,
  isActive,
  teamColor,
  onClick,
}: {
  name: string
  isActive: boolean
  teamColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: '6px',
        border: isActive ? `1px solid ${teamColor}` : `1px solid ${BORDER_SUBTLE}`,
        background: isActive ? `${teamColor}18` : 'transparent',
        color: isActive ? TEXT_PRIMARY : TEXT_DIM,
        fontSize: '12px',
        fontWeight: isActive ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: isActive ? `0 0 8px ${teamColor}33` : 'none',
        textShadow: isActive ? `0 0 8px ${teamColor}44` : 'none',
      }}
    >
      {name}
    </button>
  )
}

export default function CompareTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedT1, setSelectedT1] = useState(0)
  const [selectedT2, setSelectedT2] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch(`/api/scrim-stats?mapId=${mapId}&tab=compare`).then((r) => r.json()),
      loadHeroPortraits(),
    ])
      .then(([d]) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading comparison…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load compare data</div>

  const t1Player = data.team1Players[selectedT1]
  const t2Player = data.team2Players[selectedT2]

  const renderPlayerStats = (player: ComparePlayer | undefined, teamColor: string) => {
    if (!player) {
      return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_DIM }}>No player data</div>
    }

    const tp = player.timePlayed
    const kdRatio = player.deaths > 0 ? (player.eliminations / player.deaths).toFixed(2) : player.eliminations.toString()

    return (
      <div>
        {/* Hero header */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(6px)',
            borderRadius: '10px',
            border: `1px solid ${teamColor}18`,
            padding: '16px 20px',
            marginBottom: '12px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <HeroPortrait hero={player.hero} teamColor={teamColor} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: TEXT_DIM, marginBottom: '4px' }}>Player Statistics</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: TEXT_PRIMARY, marginBottom: '2px' }}>
              {player.hero}
            </div>
            <div style={{ fontSize: '13px', color: TEXT_SECONDARY }}>
              K/D Ratio: <span style={{ color: teamColor, fontWeight: 600 }}>{kdRatio}</span>
            </div>
          </div>
        </div>

        {/* Stats grid — 2-column layout matching parsertime */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <StatCard
            label="Time Played"
            value={`${formatMinutes(tp)} min`}
            sub={`100% of match time`}
            accentColor={CYAN}
            icon="⏱"
          />
          <StatCard
            label="Eliminations"
            value={`${player.eliminations} Elims`}
            sub={`${per10(player.eliminations, tp)} elims per 10 min`}
            accentColor={CYAN}
            icon="🎯"
          />
          <StatCard
            label="Deaths"
            value={`${player.deaths} Deaths`}
            sub={`${per10(player.deaths, tp)} deaths per 10 min`}
            accentColor={RED}
            icon="💀"
          />
          <StatCard
            label="Ultimates Used"
            value={`${player.ultimatesUsed} Ults`}
            sub={`${per10(player.ultimatesUsed, tp)} ults per 10 min`}
            accentColor={PURPLE}
            icon="⚡"
          />
          <StatCard
            label="Hero Damage Dealt"
            value={`${formatBigNumber(player.heroDamage)} Dmg`}
            sub={`${formatBigNumber(Number(per10(player.heroDamage, tp)))} dmg per 10 min`}
            accentColor={AMBER}
            icon="💥"
          />
          <StatCard
            label="Healing Dealt"
            value={`${formatBigNumber(player.healingDealt)} Heal`}
            sub={`${formatBigNumber(Number(per10(player.healingDealt, tp)))} heal per 10 min`}
            accentColor={GREEN}
            icon="💚"
          />
          <StatCard
            label="Final Blows"
            value={`${player.finalBlows} Final Blows`}
            sub={`${per10(player.finalBlows, tp)} per 10 min`}
            accentColor={CYAN}
            icon="🗡"
          />
          <StatCard
            label="Solo Kills"
            value={`${player.soloKills} Solo Kill${player.soloKills !== 1 ? 's' : ''}`}
            sub={`${per10(player.soloKills, tp)} per 10 min`}
            accentColor={PURPLE}
            icon="✦"
          />
          <StatCard
            label="Damage Blocked"
            value={`${formatBigNumber(player.damageBlocked)} Blocked`}
            sub={`${formatBigNumber(Number(per10(player.damageBlocked, tp)))} per 10 min`}
            accentColor={CYAN}
            icon="🛡"
          />
          <StatCard
            label="Damage Taken"
            value={`${formatBigNumber(player.damageTaken)} Taken`}
            sub={`${formatBigNumber(Number(per10(player.damageTaken, tp)))} per 10 min`}
            accentColor={RED}
            icon="🔥"
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* ── Team 1 ── */}
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: '14px',
            color: GREEN,
            marginBottom: '10px',
            textShadow: `0 0 12px ${GREEN}44`,
          }}
        >
          {data.teams.team1}
        </div>

        {/* Player tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {data.team1Players.map((p, i) => (
            <PlayerTab
              key={`${p.name}-${p.hero}-${i}`}
              name={p.name}
              isActive={selectedT1 === i}
              teamColor={GREEN}
              onClick={() => setSelectedT1(i)}
            />
          ))}
        </div>

        {renderPlayerStats(t1Player, GREEN)}
      </div>

      {/* ── Team 2 ── */}
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: '14px',
            color: RED,
            marginBottom: '10px',
            textShadow: `0 0 12px ${RED}44`,
          }}
        >
          {data.teams.team2}
        </div>

        {/* Player tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {data.team2Players.map((p, i) => (
            <PlayerTab
              key={`${p.name}-${p.hero}-${i}`}
              name={p.name}
              isActive={selectedT2 === i}
              teamColor={RED}
              onClick={() => setSelectedT2(i)}
            />
          ))}
        </div>

        {renderPlayerStats(t2Player, RED)}
      </div>
    </div>
  )
}
