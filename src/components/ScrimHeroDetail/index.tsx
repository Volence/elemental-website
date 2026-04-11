'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Loader2, AlertCircle, ArrowLeft, Trophy, Crown, TrendingUp, Swords, Crosshair, ChevronUp, ChevronDown } from 'lucide-react'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'

// ── Types ──

type HeroListEntry = {
  hero: string
  portrait: string | null
  role: string
  mapsPlayed: number
  totalElims: number
  totalDeaths: number
  totalDamage: number
  totalHealing: number
  totalFB: number
  totalTime: number
}

type TeamInfo = {
  rawName: string
  displayName: string
  payloadTeamId: number | null
  isOurTeam: boolean
}

type TopPlayer = {
  name: string
  mapsPlayed: number
  totalTime: number
  elimsPer10: number
  deathsPer10: number
  damagePer10: number
  healingPer10: number
  fbPer10: number
}

type BestGame = {
  player: string
  mapDataId: number
  mapName: string
  scrimName: string
  scrimDate: string
  finalBlows: number
  eliminations: number
  deaths: number
  damage: number
  healing: number
}

type TrendEntry = {
  scrimDate: string
  scrimName: string
  mapCount: number
  elimsPer10: number
  fbPer10: number
  deathsPer10: number
  damagePer10: number
  healingPer10: number
}

type HeroMatchup = { hero: string; count: number }
type FBMethod = { method: string; count: number }

type HeroDetail = {
  hero: { name: string; portrait: string | null; role: string; mapsPlayed: number; totalTime: number }
  career: {
    eliminations: number; deaths: number; damage: number; healing: number; finalBlows: number
    elimsPer10: number; deathsPer10: number; damagePer10: number; healingPer10: number; fbPer10: number
  }
  topPlayers: TopPlayer[]
  bestGame: BestGame | null
  trendData: TrendEntry[]
  heroMatchups: { killedMost: HeroMatchup[]; diedToMost: HeroMatchup[] }
  finalBlowsByMethod: FBMethod[]
}

// ── Design tokens (Clean Glow) ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const BG_CARD = 'rgba(255, 255, 255, 0.03)'
const BG_INNER = 'rgba(255, 255, 255, 0.02)'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'
const BAR_COLORS = [CYAN, PURPLE, GREEN, AMBER, RED, '#ec4899', '#6366f1']

const ROLE_COLORS: Record<string, string> = { Tank: CYAN, Damage: RED, Support: GREEN }

const RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'last7d', label: '7 Days' },
  { value: 'last30d', label: '30 Days' },
  { value: 'last10', label: '10 Scrims' },
  { value: 'last20', label: '20 Scrims' },
]

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Component ──

export default function ScrimHeroDetailView() {
  const [heroList, setHeroList] = useState<HeroListEntry[] | null>(null)
  const [heroDetail, setHeroDetail] = useState<HeroDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedHero, setSelectedHero] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [rangeFilter, setRangeFilter] = useState<string>('all')
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [teamSearch, setTeamSearch] = useState<string>('')
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [sortKey, setSortKey] = useState<string>('mapsPlayed')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [trendStat, setTrendStat] = useState<string>('damagePer10')

  // Categorized and filtered team list
  const filteredTeams = useMemo(() => {
    const ourTeams = teams.filter(t => t.isOurTeam)
    const enemyTeams = teams.filter(t => !t.isOurTeam)
    const q = teamSearch.toLowerCase()
    return {
      ourTeams: q ? ourTeams.filter(t => t.displayName.toLowerCase().includes(q)) : ourTeams,
      enemyTeams: q ? enemyTeams.filter(t => t.displayName.toLowerCase().includes(q)) : enemyTeams,
    }
  }, [teams, teamSearch])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hero = params.get('hero')
    if (hero) {
      setSelectedHero(hero)
      loadHeroDetail(hero)
    } else {
      loadHeroList()
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('#team-dropdown-container')) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function buildParams(overrides?: { team?: string; range?: string }) {
    const t = overrides?.team ?? teamFilter
    const r = overrides?.range ?? rangeFilter
    const params = new URLSearchParams()
    if (t !== 'all') params.set('team', t)
    if (r !== 'all') params.set('range', r)
    return params.toString() ? `?${params.toString()}` : ''
  }

  async function loadHeroList(team?: string, range?: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scrim-hero-stats${buildParams({ team, range })}`)
      if (!res.ok) throw new Error('Failed to load hero list')
      const data = await res.json()
      setHeroList(data.heroes)
      if (data.teams) setTeams(data.teams)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadHeroDetail(hero: string, team?: string, range?: string) {
    setLoading(true)
    setError(null)
    try {
      const params = buildParams({ team, range })
      const heroParam = `hero=${encodeURIComponent(hero)}`
      const url = `/api/scrim-hero-stats?${heroParam}${params ? '&' + params.slice(1) : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load hero detail')
      const data = await res.json()
      setHeroDetail(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function navigateToHero(hero: string) {
    window.history.pushState({}, '', `/admin/scrim-heroes?hero=${encodeURIComponent(hero)}`)
    setSelectedHero(hero)
    loadHeroDetail(hero)
  }

  function navigateBack() {
    window.history.pushState({}, '', '/admin/scrim-heroes')
    setSelectedHero(null)
    setHeroDetail(null)
    loadHeroList()
  }

  function selectTeam(displayName: string) {
    setTeamFilter(displayName)
    setTeamDropdownOpen(false)
    setTeamSearch('')
    if (selectedHero) {
      loadHeroDetail(selectedHero, displayName)
    } else {
      loadHeroList(displayName)
    }
  }

  function selectRange(range: string) {
    setRangeFilter(range)
    if (selectedHero) {
      loadHeroDetail(selectedHero, undefined, range)
    } else {
      loadHeroList(undefined, range)
    }
  }

  // ── Team Selector Dropdown ──
  function renderTeamSelector() {
    const activeLabel = teamFilter === 'all' ? 'All Teams' : teamFilter
    const isActive = teamFilter !== 'all'

    return (
      <div id="team-dropdown-container" style={{ position: 'relative' }}>
        <button
          onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
          style={{
            background: isActive ? `linear-gradient(135deg, ${PURPLE}22, ${PURPLE}11)` : BG_CARD,
            border: `1px solid ${isActive ? PURPLE + '66' : BORDER}`,
            borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
            color: isActive ? PURPLE : TEXT_SECONDARY, fontSize: '12px',
            fontWeight: isActive ? 700 : 500,
            transition: 'all 0.2s', fontFamily: "'Inter', -apple-system, sans-serif",
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          {activeLabel}
          <span style={{ display: 'inline-flex', opacity: 0.6 }}>{teamDropdownOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}</span>
        </button>

        {teamDropdownOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 100,
            background: '#181825', border: `1px solid ${BORDER}`, borderRadius: '10px',
            minWidth: '240px', maxHeight: '360px', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {/* Search input */}
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>
              <input
                type="text"
                placeholder="Search teams..."
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`,
                  borderRadius: '6px', padding: '6px 10px', color: TEXT_PRIMARY, fontSize: '12px',
                  fontFamily: "'Inter', -apple-system, sans-serif", outline: 'none',
                }}
              />
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
              {/* All Teams option */}
              <div
                onClick={() => selectTeam('all')}
                style={{
                  padding: '8px 14px', cursor: 'pointer', fontSize: '12px',
                  color: teamFilter === 'all' ? CYAN : TEXT_PRIMARY,
                  fontWeight: teamFilter === 'all' ? 700 : 400,
                  background: teamFilter === 'all' ? `${CYAN}08` : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${CYAN}0a` }}
                onMouseLeave={e => { e.currentTarget.style.background = teamFilter === 'all' ? `${CYAN}08` : 'transparent' }}
              >
                All Teams
              </div>

              {/* Our Teams */}
              {filteredTeams.ourTeams.length > 0 && (
                <>
                  <div style={{ padding: '6px 14px', fontSize: '9px', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '1.2px', borderTop: `1px solid ${BORDER}` }}>
                    Our Teams
                  </div>
                  {filteredTeams.ourTeams.map(t => (
                    <div
                      key={t.rawName}
                      onClick={() => selectTeam(t.displayName)}
                      style={{
                        padding: '7px 14px 7px 22px', cursor: 'pointer', fontSize: '12px',
                        color: teamFilter === t.displayName ? GREEN : TEXT_PRIMARY,
                        fontWeight: teamFilter === t.displayName ? 700 : 400,
                        background: teamFilter === t.displayName ? `${GREEN}08` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${GREEN}0a` }}
                      onMouseLeave={e => { e.currentTarget.style.background = teamFilter === t.displayName ? `${GREEN}08` : 'transparent' }}
                    >
                      {t.displayName}
                    </div>
                  ))}
                </>
              )}

              {/* Enemy Teams */}
              {filteredTeams.enemyTeams.length > 0 && (
                <>
                  <div style={{ padding: '6px 14px', fontSize: '9px', fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '1.2px', borderTop: `1px solid ${BORDER}` }}>
                    Opponents
                  </div>
                  {filteredTeams.enemyTeams.map(t => (
                    <div
                      key={t.rawName}
                      onClick={() => selectTeam(t.displayName)}
                      style={{
                        padding: '7px 14px 7px 22px', cursor: 'pointer', fontSize: '12px',
                        color: teamFilter === t.displayName ? RED : TEXT_SECONDARY,
                        fontWeight: teamFilter === t.displayName ? 700 : 400,
                        background: teamFilter === t.displayName ? `${RED}08` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${RED}0a` }}
                      onMouseLeave={e => { e.currentTarget.style.background = teamFilter === t.displayName ? `${RED}08` : 'transparent' }}
                    >
                      {t.displayName}
                    </div>
                  ))}
                </>
              )}

              {filteredTeams.ourTeams.length === 0 && filteredTeams.enemyTeams.length === 0 && teamSearch && (
                <div style={{ padding: '12px 14px', fontSize: '12px', color: TEXT_DIM, textAlign: 'center' }}>
                  No teams match &quot;{teamSearch}&quot;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Range Filter Pills ──
  function renderRangeFilter() {
    return (
      <>
        {RANGE_OPTIONS.map(r => {
          const isActive = rangeFilter === r.value
          return (
            <button
              key={r.value}
              onClick={() => selectRange(r.value)}
              style={{
                background: isActive ? `linear-gradient(135deg, ${AMBER}22, ${AMBER}11)` : BG_CARD,
                border: `1px solid ${isActive ? AMBER + '66' : BORDER}`,
                borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                color: isActive ? AMBER : TEXT_SECONDARY, fontSize: '11px', fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s', fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              {r.label}
            </button>
          )
        })}
      </>
    )
  }

  // ── Loading / Error states ──
  if (loading) {
    return (
      <>
      <ScrimAnalyticsTabs activeTab="heroes" />
      <div className="scrim-players__loading">
        <div className="scrim-players__loading-icon"><Loader2 size={32} /></div>
        <div className="scrim-players__loading-text">Loading hero stats...</div>
      </div>
      </>
    )
  }

  if (error) {
    return (
      <>
      <ScrimAnalyticsTabs activeTab="heroes" />
      <div className="scrim-players__error">
        <p><AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />{error}</p>
      </div>
      </>
    )
  }

  // ── Hero Detail View ──
  if (selectedHero && heroDetail) {
    return <><ScrimAnalyticsTabs activeTab="heroes" />{renderHeroDetail()}</>
  }

  // ── Hero List View ──
  if (heroList) {
    return <><ScrimAnalyticsTabs activeTab="heroes" />{renderHeroList()}</>
  }

  return null

  // ═══════════════════════════════════════════════════
  // Hero List View
  // ═══════════════════════════════════════════════════
  function renderHeroList() {
    if (!heroList) return null

    // Filter by role
    const filtered = roleFilter === 'all' ? heroList : heroList.filter(h => h.role === roleFilter)

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey] as number ?? 0
      const bVal = (b as Record<string, unknown>)[sortKey] as number ?? 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })

    const handleSort = (key: string) => {
      if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
      else { setSortKey(key); setSortDir('desc') }
    }

    const SortHeader = ({ label, field }: { label: string; field: string }) => (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: sortKey === field ? CYAN : TEXT_SECONDARY,
          fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer',
          userSelect: 'none', whiteSpace: 'nowrap',
        }}
      >
        {label} {sortKey === field ? (sortDir === 'desc' ? <ChevronDown size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <ChevronUp size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />) : ''}
      </th>
    )

    // Build subtitle
    const filterParts: string[] = []
    if (teamFilter !== 'all') filterParts.push(teamFilter)
    const rangeLbl = RANGE_OPTIONS.find(r => r.value === rangeFilter)?.label
    if (rangeFilter !== 'all' && rangeLbl) filterParts.push(rangeLbl)
    const subtitle = filterParts.length > 0
      ? `Showing ${heroList.length} heroes · ${filterParts.join(' · ')}`
      : `Aggregate hero performance across all scrims · ${heroList.length} heroes tracked`

    return (
      <div className="scrim-detail__content" style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div className="scrim-detail__header">
          <h1 className="scrim-detail__player-name" style={{ fontSize: '28px' }}>
            Hero Stats
          </h1>
          <p className="scrim-detail__player-meta" style={{ marginTop: '6px' }}>
            {subtitle}
          </p>
        </div>

        {/* Filters Row: Team | Range | Role */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {renderTeamSelector()}

          <div style={{ width: '1px', height: '24px', background: BORDER, margin: '0 4px' }} />

          {renderRangeFilter()}

          <div style={{ width: '1px', height: '24px', background: BORDER, margin: '0 4px' }} />

          {['all', 'Tank', 'Damage', 'Support'].map(r => {
            const isActive = roleFilter === r
            const col = r === 'all' ? CYAN : (ROLE_COLORS[r] ?? CYAN)
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  background: isActive ? `linear-gradient(135deg, ${col}22, ${col}11)` : BG_CARD,
                  border: `1px solid ${isActive ? col + '66' : BORDER}`,
                  borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                  color: isActive ? col : TEXT_SECONDARY, fontSize: '11px', fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.2s', fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                {r === 'all' ? 'All Roles' : r}
              </button>
            )
          })}
        </div>

        {/* Hero Table */}
        <div className="scrim-detail__map-table-card">
          <div className="scrim-detail__map-table-scroll">
            <table className="scrim-detail__map-table">
              <thead>
                <tr>
                  <th className="scrim-detail__map-th">Hero</th>
                  <th className="scrim-detail__map-th">Role</th>
                  <SortHeader label="Maps" field="mapsPlayed" />
                  <SortHeader label="Elims" field="totalElims" />
                  <SortHeader label="Deaths" field="totalDeaths" />
                  <SortHeader label="Damage" field="totalDamage" />
                  <SortHeader label="Healing" field="totalHealing" />
                  <SortHeader label="FB" field="totalFB" />
                  <SortHeader label="Time Played" field="totalTime" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(h => (
                  <tr
                    key={h.hero}
                    onClick={() => navigateToHero(h.hero)}
                    className="scrim-detail__map-row"
                  >
                    <td className="scrim-detail__map-td" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {h.portrait && <img src={h.portrait} alt={h.hero} style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${ROLE_COLORS[h.role] ?? CYAN}33` }} />}
                      <span className="scrim-detail__map-td--map" style={{ padding: 0 }}>{h.hero}</span>
                    </td>
                    <td className="scrim-detail__map-td">
                      <span style={{ fontSize: '10px', fontWeight: 600, color: ROLE_COLORS[h.role] ?? TEXT_DIM, padding: '2px 8px', borderRadius: '4px', background: `${ROLE_COLORS[h.role] ?? TEXT_DIM}15` }}>
                        {h.role}
                      </span>
                    </td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ fontWeight: 600 }}>{h.mapsPlayed}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(h.totalElims)}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(h.totalDeaths)}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(h.totalDamage)}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(h.totalHealing)}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(h.totalFB)}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: TEXT_DIM }}>{formatTime(h.totalTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // Hero Detail View
  // ═══════════════════════════════════════════════════
  function renderHeroDetail() {
    if (!heroDetail) return null
    const { hero, career, topPlayers, bestGame, trendData, heroMatchups, finalBlowsByMethod } = heroDetail

    const TREND_STATS: Record<string, { label: string; color: string }> = {
      elimsPer10: { label: 'Eliminations /10', color: AMBER },
      fbPer10: { label: 'Final Blows /10', color: GREEN },
      deathsPer10: { label: 'Deaths /10', color: RED },
      damagePer10: { label: 'Damage /10', color: CYAN },
      healingPer10: { label: 'Healing /10', color: PURPLE },
    }
    const selectedStat = TREND_STATS[trendStat] ?? TREND_STATS.damagePer10

    // Build filter badges
    const badges: Array<{ label: string; color: string }> = []
    if (teamFilter !== 'all') badges.push({ label: teamFilter, color: PURPLE })
    const rangeLbl = RANGE_OPTIONS.find(r => r.value === rangeFilter)?.label
    if (rangeFilter !== 'all' && rangeLbl) badges.push({ label: rangeLbl, color: AMBER })

    return (
      <div className="scrim-detail__content" style={{ maxWidth: '1200px' }}>
        {/* Back Link + Header */}
        <div className="scrim-detail__header">
          <button
            onClick={navigateBack}
            className="scrim-detail__back-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '12px' }}
          >
            <ArrowLeft size={12} /> Back to Heroes
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {hero.portrait && <img src={hero.portrait} alt={hero.name} style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${ROLE_COLORS[hero.role] ?? CYAN}44` }} />}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: TEXT_PRIMARY, margin: 0, letterSpacing: '-0.5px' }}>{hero.name}</h1>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: ROLE_COLORS[hero.role] ?? TEXT_DIM, padding: '2px 10px', borderRadius: '4px', background: `${ROLE_COLORS[hero.role] ?? TEXT_DIM}15` }}>
                  {hero.role}
                </span>
                <span style={{ fontSize: '12px', color: TEXT_DIM }}>{hero.mapsPlayed} maps • {formatTime(hero.totalTime)} played</span>
                {badges.map(b => (
                  <span key={b.label} style={{ fontSize: '10px', fontWeight: 600, color: b.color, padding: '2px 10px', borderRadius: '4px', background: `${b.color}15` }}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Filters on detail page too */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {renderTeamSelector()}
            <div style={{ width: '1px', height: '24px', background: BORDER, margin: '0 4px' }} />
            {renderRangeFilter()}
          </div>
        </div>

        {/* Career Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Elims /10', value: career.elimsPer10, total: career.eliminations, color: AMBER },
            { label: 'FB /10', value: career.fbPer10, total: career.finalBlows, color: GREEN },
            { label: 'Deaths /10', value: career.deathsPer10, total: career.deaths, color: RED },
            { label: 'Damage /10', value: formatNumber(career.damagePer10), total: career.damage, color: CYAN },
            { label: 'Healing /10', value: formatNumber(career.healingPer10), total: career.healing, color: PURPLE },
          ].map(s => (
            <div key={s.label} className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${s.color}`, textAlign: 'center' }}>
              <div className="scrim-detail__label">{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, textShadow: `0 0 16px ${s.color}33` }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: TEXT_DIM, marginTop: '4px' }}>{formatNumber(s.total)} total</div>
            </div>
          ))}
        </div>

        {/* Best Game Highlight */}
        {bestGame && (
          <div className="scrim-detail__card" style={{ marginBottom: '24px', borderLeft: `3px solid ${AMBER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="scrim-detail__label"><Trophy size={14} className="scrim-detail__inline-icon" /> Best Performance</div>
              <div style={{ fontSize: '14px', color: TEXT_PRIMARY, fontWeight: 600 }}>{bestGame.player} on {bestGame.mapName}</div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px' }}>{bestGame.scrimName} · {formatDate(bestGame.scrimDate)}</div>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {[
                { label: 'FB', value: bestGame.finalBlows, color: GREEN },
                { label: 'Elims', value: bestGame.eliminations, color: AMBER },
                { label: 'Deaths', value: bestGame.deaths, color: RED },
                { label: 'Damage', value: formatNumber(bestGame.damage), color: CYAN },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Players Table */}
        {topPlayers.length > 0 && (
          <div className="scrim-detail__map-table-card" style={{ marginBottom: '24px' }}>
            <div className="scrim-detail__map-table-header">
              Top Players on {hero.name}
            </div>
            <div className="scrim-detail__map-table-scroll">
              <table className="scrim-detail__map-table">
                <thead>
                  <tr>
                    {['Player', 'Maps', 'Time', 'Elims /10', 'FB /10', 'Deaths /10', 'Damage /10', 'Healing /10'].map(label => (
                      <th key={label} className={`scrim-detail__map-th ${label !== 'Player' ? 'scrim-detail__map-th--right' : ''}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((p, idx) => (
                    <tr
                      key={p.name}
                      className="scrim-detail__map-row"
                      onClick={() => window.location.href = `/admin/scrim-player-detail?player=${encodeURIComponent(p.name)}`}
                    >
                      <td className="scrim-detail__map-td" style={{ fontWeight: 600, color: idx === 0 ? AMBER : CYAN }}>
                        {idx === 0 ? <><Crown size={12} style={{ verticalAlign: 'text-bottom', marginRight: '2px' }} /> </> : ''}{p.name}
                      </td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat">{p.mapsPlayed}</td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: TEXT_DIM }}>{formatTime(p.totalTime)}</td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat">{p.elimsPer10}</td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat">{p.fbPer10}</td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat">{p.deathsPer10}</td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(p.damagePer10)}</td>
                      <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(p.healingPer10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {trendData.length > 1 && (
          <div className="scrim-detail__card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY }}>
                <TrendingUp size={14} className="scrim-detail__inline-icon" /> Per-Scrim Trend: {selectedStat.label}
              </div>
              <select
                value={trendStat}
                onChange={e => setTrendStat(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px',
                  padding: '6px 12px', color: TEXT_PRIMARY, fontSize: '12px',
                  cursor: 'pointer', fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                {Object.entries(TREND_STATS).map(([key, { label }]) => (
                  <option key={key} value={key} style={{ background: '#1a1a2e' }}>{label}</option>
                ))}
              </select>
            </div>
            {/* Inline SVG Bar Chart */}
            {(() => {
              const chartData = trendData.map(t => ({
                label: new Date(t.scrimDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: (t as Record<string, unknown>)[trendStat] as number ?? 0,
              }))
              const maxVal = Math.max(...chartData.map(d => d.value), 1)
              const barW = Math.max(20, Math.min(60, 700 / chartData.length))
              const chartH = 200
              const chartW = chartData.length * (barW + 8)

              return (
                <div style={{ overflowX: 'auto' }}>
                  <svg width={Math.max(chartW, 200)} height={chartH + 40} viewBox={`0 0 ${Math.max(chartW, 200)} ${chartH + 40}`}>
                    {chartData.map((d, i) => {
                      const barH = maxVal > 0 ? (d.value / maxVal) * chartH : 0
                      const x = i * (barW + 8) + 4
                      return (
                        <g key={i}>
                          <rect x={x} y={chartH - barH} width={barW} height={barH} rx={4}
                            fill={selectedStat.color} opacity={0.7} />
                          <text x={x + barW / 2} y={chartH - barH - 6} textAnchor="middle"
                            fill={TEXT_SECONDARY} fontSize={9} fontWeight={600}>
                            {d.value}
                          </text>
                          <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                            fill={TEXT_DIM} fontSize={8} transform={`rotate(-30 ${x + barW / 2} ${chartH + 16})`}>
                            {d.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              )
            })()}
            <p style={{ color: TEXT_DIM, fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
              Across {trendData.length} scrim{trendData.length !== 1 ? 's' : ''}, sorted chronologically
            </p>
          </div>
        )}

        {/* Hero Matchups + FB Method in 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {/* Hero Matchups */}
          {(heroMatchups.killedMost.length > 0 || heroMatchups.diedToMost.length > 0) && (
            <div className="scrim-detail__card">
              <div className="scrim-detail__label"><Swords size={14} className="scrim-detail__inline-icon" /> Hero Matchups</div>
              {/* Killed Most */}
              {heroMatchups.killedMost.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: GREEN, marginBottom: '8px', fontWeight: 600, letterSpacing: '0.5px' }}>ELIMINATED MOST</div>
                  {heroMatchups.killedMost.map((m, i) => {
                    const maxCount = heroMatchups.killedMost[0]?.count ?? 1
                    return (
                      <div key={m.hero} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                        <span style={{ fontSize: '11px', color: TEXT_DIM, width: '14px', textAlign: 'right' }}>{i + 1}</span>
                        <span style={{ fontSize: '11px', color: TEXT_PRIMARY, fontWeight: 500, minWidth: '90px' }}>{m.hero}</span>
                        <div style={{ flex: 1, height: '5px', background: BG_INNER, borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(m.count / maxCount) * 100}%`, borderRadius: '3px', background: `linear-gradient(90deg, ${GREEN}88, ${GREEN}44)` }} />
                        </div>
                        <span style={{ fontSize: '11px', color: GREEN, fontWeight: 700, minWidth: '28px', textAlign: 'right' }}>{m.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Died To Most */}
              {heroMatchups.diedToMost.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: RED, marginBottom: '8px', fontWeight: 600, letterSpacing: '0.5px' }}>DIED TO MOST</div>
                  {heroMatchups.diedToMost.map((m, i) => {
                    const maxCount = heroMatchups.diedToMost[0]?.count ?? 1
                    return (
                      <div key={m.hero} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                        <span style={{ fontSize: '11px', color: TEXT_DIM, width: '14px', textAlign: 'right' }}>{i + 1}</span>
                        <span style={{ fontSize: '11px', color: TEXT_PRIMARY, fontWeight: 500, minWidth: '90px' }}>{m.hero}</span>
                        <div style={{ flex: 1, height: '5px', background: BG_INNER, borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(m.count / maxCount) * 100}%`, borderRadius: '3px', background: `linear-gradient(90deg, ${RED}88, ${RED}44)` }} />
                        </div>
                        <span style={{ fontSize: '11px', color: RED, fontWeight: 700, minWidth: '28px', textAlign: 'right' }}>{m.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Final Blows By Method */}
          {finalBlowsByMethod.length > 0 && (
            <div className="scrim-detail__card">
              <div className="scrim-detail__label"><Crosshair size={14} className="scrim-detail__inline-icon" /> Final Blows By Method</div>
              {(() => {
                const maxCount = finalBlowsByMethod[0]?.count ?? 1
                const total = finalBlowsByMethod.reduce((a, m) => a + m.count, 0)
                return finalBlowsByMethod.map((m, i) => (
                  <div key={m.method} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                    <span style={{ fontSize: '11px', color: TEXT_PRIMARY, fontWeight: 500, minWidth: '120px' }}>{m.method}</span>
                    <div style={{ flex: 1, height: '7px', background: BG_INNER, borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(m.count / maxCount) * 100}%`, borderRadius: '4px', background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}88, ${BAR_COLORS[i % BAR_COLORS.length]}44)` }} />
                    </div>
                    <span style={{ fontSize: '11px', color: BAR_COLORS[i % BAR_COLORS.length], fontWeight: 700, minWidth: '36px', textAlign: 'right' }}>{m.count}</span>
                    <span style={{ fontSize: '10px', color: TEXT_DIM, minWidth: '34px' }}>({total > 0 ? ((m.count / total) * 100).toFixed(1) : 0}%)</span>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>
    )
  }
}
