'use client'

import React, { useState, useEffect, useMemo } from 'react'
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

// Group players by name, each name can have multiple hero entries
type PlayerGroup = { name: string; heroes: ComparePlayer[] }

function groupByPlayer(players: ComparePlayer[]): PlayerGroup[] {
  const map = new Map<string, ComparePlayer[]>()
  for (const p of players) {
    // Skip players with 0 time played (no actual stats)
    if (p.timePlayed <= 0) continue
    if (!map.has(p.name)) map.set(p.name, [])
    map.get(p.name)!.push(p)
  }
  return Array.from(map.entries()).map(([name, heroes]) => ({ name, heroes }))
}

function formatMinutes(seconds: number): string {
  return (seconds / 60).toFixed(1)
}

function per10(value: number, timePlayed: number): string {
  if (timePlayed <= 0) return '0'
  return ((value / timePlayed) * 600).toFixed(1)
}

function formatBigNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n).toString()
}

// ── Hero Portrait ──
function HeroPortrait({ hero, teamColor }: { hero: string; teamColor: string }) {
  const [failed, setFailed] = useState(false)
  const url = getHeroIconUrl(hero)
  const size = 100

  if (failed || !url) {
    return (
      <div
        title={hero}
        style={{
          width: size,
          height: size,
          borderRadius: '8px',
          border: `2px solid ${teamColor}`,
          boxShadow: `0 0 12px ${teamColor}44`,
          background: `${teamColor}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
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
        width={size}
        height={size}
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
}: {
  label: string
  value: string
  sub: string
  accentColor: string
}) {
  return (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(4px)',
        borderRadius: '10px',
        border: `1px solid ${BORDER_SUBTLE}`,
        padding: '18px 20px',
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
          width: '3px',
          background: accentColor,
          boxShadow: `0 0 6px ${accentColor}44`,
        }}
      />
      <div style={{ fontSize: '11px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '8px' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: TEXT_PRIMARY,
          lineHeight: 1,
          marginBottom: '8px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '11px', color: TEXT_DIM }}>{sub}</div>
    </div>
  )
}

// ── Player Tab Button ──
function PlayerTab({
  name,
  isActive,
  teamColor,
  heroCount,
  onClick,
}: {
  name: string
  isActive: boolean
  teamColor: string
  heroCount: number
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
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {name}
      {heroCount > 1 && (
        <span style={{ fontSize: '9px', opacity: 0.6 }}>({heroCount})</span>
      )}
    </button>
  )
}

// ── Hero Selector Dropdown ──
function HeroSelector({
  heroes,
  selectedIndex,
  onChange,
  teamColor,
}: {
  heroes: ComparePlayer[]
  selectedIndex: number
  onChange: (i: number) => void
  teamColor: string
}) {
  if (heroes.length <= 1) return null

  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
      {heroes.map((h, i) => (
        <button
          key={`${h.hero}-${i}`}
          onClick={() => onChange(i)}
          style={{
            padding: '5px 12px',
            borderRadius: '6px',
            border: selectedIndex === i ? `1px solid ${teamColor}` : `1px solid ${BORDER_SUBTLE}`,
            background: selectedIndex === i ? `${teamColor}14` : 'rgba(0,0,0,0.1)',
            color: selectedIndex === i ? TEXT_PRIMARY : TEXT_SECONDARY,
            fontSize: '12px',
            fontWeight: selectedIndex === i ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <HeroMiniIcon hero={h.hero} teamColor={teamColor} />
          {h.hero}
          <span style={{ fontSize: '10px', color: TEXT_DIM }}>
            {formatMinutes(h.timePlayed)}m
          </span>
        </button>
      ))}
    </div>
  )
}

function HeroMiniIcon({ hero, teamColor }: { hero: string; teamColor: string }) {
  const [failed, setFailed] = useState(false)
  const url = getHeroIconUrl(hero)
  const size = 18

  if (failed || !url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '3px',
          border: `1px solid ${teamColor}`,
          background: `${teamColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: 700,
          color: teamColor,
        }}
      >
        {hero.charAt(0)}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={hero}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ borderRadius: '3px', border: `1px solid ${teamColor}`, objectFit: 'cover' }}
    />
  )
}

// ── Team Side Component ──
function TeamSide({
  teamName,
  teamColor,
  groups,
}: {
  teamName: string
  teamColor: string
  groups: PlayerGroup[]
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(0)
  const [selectedHero, setSelectedHero] = useState(0)

  // Reset hero selection when player changes
  const handlePlayerChange = (i: number) => {
    setSelectedPlayer(i)
    setSelectedHero(0)
  }

  const group = groups[selectedPlayer]
  if (!group) {
    return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_DIM }}>No player data</div>
  }

  const player = group.heroes[selectedHero]
  if (!player) return null

  const tp = player.timePlayed
  const kdRatio = player.deaths > 0 ? (player.eliminations / player.deaths).toFixed(2) : player.eliminations.toString()

  return (
    <div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '14px',
          color: teamColor,
          marginBottom: '10px',
          textShadow: `0 0 12px ${teamColor}44`,
        }}
      >
        {teamName}
      </div>

      {/* Player tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {groups.map((g, i) => (
          <PlayerTab
            key={g.name}
            name={g.name}
            isActive={selectedPlayer === i}
            teamColor={teamColor}
            heroCount={g.heroes.length}
            onClick={() => handlePlayerChange(i)}
          />
        ))}
      </div>

      {/* Hero selector (only shows if player has multiple heroes) */}
      <HeroSelector
        heroes={group.heroes}
        selectedIndex={selectedHero}
        onChange={setSelectedHero}
        teamColor={teamColor}
      />

      {/* Hero header */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(6px)',
          borderRadius: '10px',
          border: `1px solid ${teamColor}18`,
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <HeroPortrait hero={player.hero} teamColor={teamColor} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: TEXT_PRIMARY, marginBottom: '4px' }}>
            {player.hero}
          </div>
          <div style={{ fontSize: '14px', color: TEXT_SECONDARY, marginBottom: '2px' }}>
            {group.name}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
            <span style={{ fontSize: '13px', color: TEXT_DIM }}>
              K/D <span style={{ color: teamColor, fontWeight: 700, fontSize: '15px' }}>{kdRatio}</span>
            </span>
            <span style={{ fontSize: '13px', color: TEXT_DIM }}>
              Time <span style={{ color: TEXT_SECONDARY, fontWeight: 600 }}>{formatMinutes(tp)}m</span>
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <StatCard
          label="Eliminations"
          value={`${player.eliminations}`}
          sub={`${per10(player.eliminations, tp)} / 10 min`}
          accentColor={CYAN}
        />
        <StatCard
          label="Deaths"
          value={`${player.deaths}`}
          sub={`${per10(player.deaths, tp)} / 10 min`}
          accentColor={RED}
        />
        <StatCard
          label="Hero Damage"
          value={formatBigNumber(player.heroDamage)}
          sub={`${formatBigNumber(Number(per10(player.heroDamage, tp)))} / 10 min`}
          accentColor={AMBER}
        />
        <StatCard
          label="Healing Dealt"
          value={formatBigNumber(player.healingDealt)}
          sub={`${formatBigNumber(Number(per10(player.healingDealt, tp)))} / 10 min`}
          accentColor={GREEN}
        />
        <StatCard
          label="Final Blows"
          value={`${player.finalBlows}`}
          sub={`${per10(player.finalBlows, tp)} / 10 min`}
          accentColor={CYAN}
        />
        <StatCard
          label="Solo Kills"
          value={`${player.soloKills}`}
          sub={`${per10(player.soloKills, tp)} / 10 min`}
          accentColor={PURPLE}
        />
        <StatCard
          label="Ultimates Used"
          value={`${player.ultimatesUsed}`}
          sub={`${per10(player.ultimatesUsed, tp)} / 10 min`}
          accentColor={PURPLE}
        />
        <StatCard
          label="Damage Blocked"
          value={formatBigNumber(player.damageBlocked)}
          sub={`${formatBigNumber(Number(per10(player.damageBlocked, tp)))} / 10 min`}
          accentColor={CYAN}
        />
        <StatCard
          label="Damage Taken"
          value={formatBigNumber(player.damageTaken)}
          sub={`${formatBigNumber(Number(per10(player.damageTaken, tp)))} / 10 min`}
          accentColor={RED}
        />
        <StatCard
          label="Critical Hits"
          value={`${player.criticalHits}`}
          sub={`${(player.weaponAccuracy).toFixed(0)}% weapon accuracy`}
          accentColor={AMBER}
        />
      </div>
    </div>
  )
}

export default function CompareTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/scrim-stats?mapId=${mapId}&tab=compare`).then((r) => r.json()),
      loadHeroPortraits(),
    ])
      .then(([d]) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  // Group players by name and filter out zero-stat entries
  const t1Groups = useMemo(() => data ? groupByPlayer(data.team1Players) : [], [data])
  const t2Groups = useMemo(() => data ? groupByPlayer(data.team2Players) : [], [data])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading comparison…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load compare data</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
      <TeamSide teamName={data.teams.team1} teamColor={GREEN} groups={t1Groups} />
      <TeamSide teamName={data.teams.team2} teamColor={RED} groups={t2Groups} />
    </div>
  )
}
