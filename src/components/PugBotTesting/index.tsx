'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Wifi, WifiOff, Zap, Play, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Power, PowerOff, RefreshCw, Pause,
  Square, Monitor, Bot, UserPlus, Users, Gamepad2, Code, Send,
  RotateCcw, ServerCrash, Camera, X, RefreshCcw, ScanLine,
} from 'lucide-react'
import { PUG_ADMIN_CSS } from '@/components/pugAdminStyles'
import { useAlert, useConfirm } from '@/components/ConfirmDialog'

type BotHealth = {
  reachable: boolean
  authError?: boolean
  status?: string
  instances?: number
  idle?: number
  inGame?: number
  error?: string
} | null

type LivePlayerStats = {
  team: string
  hero: string
  eliminations: number
  finalBlows: number
  deaths: number
  damageDelt: number
  heroDamage: number
  healingDealt: number
}

type LiveStats = {
  map: string | null
  mapType: string | null
  team1: { name: string; score: number; players: Record<string, LivePlayerStats> }
  team2: { name: string; score: number; players: Record<string, LivePlayerStats> }
  round: number
  matchTime: number
  matchEnded: boolean
  matchResult: string | null
  eventCount: number
}

type BotInstance = {
  id: string
  state: string
  statusDetail?: string | null
  pugLobbyId: number | null
  account: string
  battleTag?: string | null
  lobbyNumber?: number | null
  workshopCode?: string | null
  playerCount?: number
  liveStats?: LiveStats | null
}

type PlayerRoster = {
  userId: number | null
  battleTag: string | null
  team: number | null
  status: string
}

type ActiveLobby = {
  id: number
  lobbyNumber: number
  status: string
  botStatus?: string | null
  botInstanceId?: string | null
}

const STATE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  available: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', label: 'Available' },
  warming_up: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', label: 'Warming Up' },
  ready: { color: '#2dd4bf', bg: 'rgba(45,212,191,0.1)', label: 'Ready' },
  creating_lobby: { color: '#facc15', bg: 'rgba(250,204,21,0.1)', label: 'In Lobby' },
  waiting_for_players: { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', label: 'Waiting for Players' },
  in_game: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', label: 'In Game' },
  post_game: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', label: 'Post Game' },
  error: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'Error' },
}

const PLAYER_STATUS_COLOR: Record<string, string> = {
  joined: '#4ade80',
  invited: '#facc15',
  inviting: '#60a5fa',
  pending: '#64748b',
  left: '#f87171',
  failed: '#f87171',
  timed_out: '#fb923c',
  no_tag: '#64748b',
}

const BOT_STATUSES = ['creating', 'waiting_for_players', 'players_joining', 'in_game', 'match_complete', 'error']

function getDisplayName(instance: BotInstance): string {
  if (instance.battleTag) return instance.battleTag
  return instance.account.split('@')[0]
}

function getStateConfig(state: string) {
  return STATE_CONFIG[state] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: state }
}

function TimeAgo({ date }: { date: Date | null }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [])
  if (!date) return null
  const secs = Math.round((Date.now() - date.getTime()) / 1000)
  return <>{secs}s ago</>
}

// ── Settings Generator (inline) ──

const MODE_BY_MAP_TYPE: Record<string, string> = {
  clash: 'Clash', control: 'Control', escort: 'Escort',
  flashpoint: 'Flashpoint', hybrid: 'Hybrid', push: 'Push',
}

const MODE_SETTINGS: Record<string, string[]> = {
  Clash: ['\t\t\tCapture Speed Modifier: 45%'],
  Control: ['\t\t\tCompetitive Rules: On'],
  Escort: ['\t\t\tCompetitive Rules: On'],
  Flashpoint: ['\t\t\tCompetitive Rules: On'],
  Hybrid: ['\t\t\tCompetitive Rules: On'],
  Push: ['\t\t\tCompetitive Rules: On'],
}

const ALL_MODES = ['Clash', 'Control', 'Escort', 'Flashpoint', 'Hybrid', 'Push']
const VARIANT_MAPS: Record<string, string[]> = { Control: ['Lijiang Tower Lunar New Year'] }
const BROKEN_MAP_NAMES = ['Samoa', 'Colosseo', 'Esperança']

type MapData = { id: number; name: string; type: string; settingsEntry?: string }
type HeroData = { id: number; name: string; role: string }

function buildSettingsCode(
  mapSettingsEntry: string | null, mapType: string,
  bannedHeroes: string[], otherMapsInMode?: string[], hostNote?: string,
): string {
  const targetMode = MODE_BY_MAP_TYPE[mapType]
  const useDisabled = otherMapsInMode && otherMapsInMode.length > 0
  const lines: string[] = []
  if (hostNote) lines.push(`// HOST: ${hostNote}`)
  lines.push('settings', '{')
  lines.push('\tmain', '\t{', '\t\tMode Name: "Competitive Rules"', '\t}', '')
  lines.push('\tlobby', '\t{', '\t\tData Center Preference: USA - Central', '\t\tPause Game On Player Disconnect: Yes', '\t}', '')
  lines.push('\tmodes', '\t{')
  for (const mode of ALL_MODES) {
    const settings = MODE_SETTINGS[mode]
    lines.push(`\t\t${mode}`, '\t\t{')
    if (settings) lines.push(...settings, '')
    if (mode === targetMode && useDisabled) {
      const variants = VARIANT_MAPS[mode] ?? []
      const toDisable = [...otherMapsInMode, ...variants].filter((n) => !BROKEN_MAP_NAMES.includes(n))
      if (toDisable.length > 0) {
        lines.push('\t\t\tdisabled maps', '\t\t\t{')
        for (const n of toDisable) lines.push(`\t\t\t\t${n}`)
        lines.push('\t\t\t}')
      }
    } else {
      lines.push('\t\t\tenabled maps', '\t\t\t{')
      if (mode === targetMode && mapSettingsEntry) lines.push(`\t\t\t\t${mapSettingsEntry}`)
      lines.push('\t\t\t}')
    }
    lines.push('\t\t}', '')
  }
  lines.push('\t\tGeneral', '\t\t{')
  lines.push('\t\t\tLimit Roles: 1 Tank 2 Offense 2 Support')
  lines.push('\t\t\tRandom Hero Role Limit Per Team: 5')
  lines.push('\t\t}')
  lines.push('\t}')
  if (bannedHeroes.length > 0) {
    lines.push('', '\theroes', '\t{', '\t\tGeneral', '\t\t{', '\t\t\tdisabled heroes', '\t\t\t{')
    for (const hero of bannedHeroes) lines.push(`\t\t\t\t${hero}`)
    lines.push('\t\t\t}', '\t\t}', '\t}')
  }
  lines.push('}')
  return lines.join('\n')
}

function CodeImportPanel({
  onImport,
  onCancel,
  disabled,
}: {
  onImport: (code: string, meta?: { mapSettingsEntry?: string; mapType?: string; bannedHeroes?: string[]; otherMapsInMode?: string[]; hostNote?: string }) => void
  onCancel: () => void
  disabled: boolean
}) {
  const [maps, setMaps] = useState<MapData[]>([])
  const [heroes, setHeroes] = useState<HeroData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null)
  const [bannedHeroIds, setBannedHeroIds] = useState<number[]>([])
  const [manualMode, setManualMode] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/maps?limit=100&sort=name&depth=0').then((r) => r.json()),
      fetch('/api/heroes?limit=100&sort=name&depth=0&where[active][equals]=true').then((r) => r.json()),
    ])
      .then(([mapData, heroData]) => {
        setMaps((mapData.docs || []).map((m: any) => ({ id: m.id, name: m.name, type: m.type, settingsEntry: m.settingsEntry ?? undefined })))
        setHeroes((heroData.docs || []).map((h: any) => ({ id: h.id, name: h.name, role: h.role })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const selectedMap = maps.find((m) => m.id === selectedMapId)
  const groupedHeroes = {
    tank: heroes.filter((h) => h.role === 'tank'),
    dps: heroes.filter((h) => h.role === 'damage' || h.role === 'dps'),
    support: heroes.filter((h) => h.role === 'support'),
  }

  function handleGenerate() {
    if (!selectedMap) return
    const bannedNames = heroes.filter((h) => bannedHeroIds.includes(h.id)).map((h) => h.name)
    let otherMapsInMode: string[] | undefined
    let hostNote: string | undefined
    if (BROKEN_MAP_NAMES.includes(selectedMap.name)) {
      otherMapsInMode = maps.filter((m) => m.type === selectedMap.type && m.name !== selectedMap.name).map((m) => m.name)
      const brokenPush = ['Colosseo', 'Esperança']
      if (brokenPush.includes(selectedMap.name)) {
        const other = brokenPush.find((n) => n !== selectedMap.name)
        if (other) hostNote = `Manually disable ${other} in Push > Maps`
      }
    }
    // Send a placeholder code + metadata so the server generates the full bot code
    onImport('__generate__', {
      mapSettingsEntry: selectedMap.settingsEntry || selectedMap.name,
      mapType: selectedMap.type,
      bannedHeroes: bannedNames,
      otherMapsInMode,
      hostNote,
    })
  }

  if (loading) return <div style={{ fontSize: 12, color: '#64748b', padding: '12px 0' }}>Loading maps & heroes...</div>

  const chipStyle = (active: boolean, color?: string) => ({
    padding: '3px 8px',
    fontSize: 10,
    borderRadius: 4,
    border: `1px solid ${active ? (color ?? '#60a5fa') : 'rgba(255,255,255,0.08)'}`,
    background: active ? `${color ?? '#60a5fa'}22` : 'rgba(0,0,0,0.2)',
    color: active ? (color ?? '#93c5fd') : '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  const roleColors: Record<string, string> = { tank: '#facc15', dps: '#f87171', support: '#4ade80' }

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Import Settings</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="ps-btn ps-btn-ghost"
            style={{ padding: '2px 8px', fontSize: 10 }}
            onClick={() => setManualMode(!manualMode)}
          >
            {manualMode ? 'Use Generator' : 'Paste Manually'}
          </button>
          <button
            className="ps-btn ps-btn-ghost"
            style={{ padding: '2px 8px', fontSize: 10 }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      {manualMode ? (
        <>
          <textarea
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Paste workshop settings code..."
            style={{
              width: '100%', minHeight: 80, maxHeight: 160, padding: '8px 10px',
              fontSize: 11, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
              color: '#e2e8f0', outline: 'none', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              className="ps-btn ps-btn-primary"
              style={{ padding: '4px 12px', fontSize: 11 }}
              onClick={() => { if (manualCode.trim()) onImport(manualCode.trim()) }}
              disabled={!manualCode.trim() || disabled}
            >
              <Send size={11} /> Import
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Map picker */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Map</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {maps.map((m) => (
                <button
                  key={m.id}
                  style={chipStyle(m.id === selectedMapId)}
                  onClick={() => setSelectedMapId(m.id === selectedMapId ? null : m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Hero bans */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>
              Hero Bans {bannedHeroIds.length > 0 && <span style={{ color: '#f87171' }}>({bannedHeroIds.length})</span>}
            </div>
            {(['tank', 'dps', 'support'] as const).map((role) => (
              <div key={role} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: roleColors[role], fontWeight: 600, marginBottom: 2, textTransform: 'uppercase' }}>{role}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {groupedHeroes[role].map((h) => {
                    const banned = bannedHeroIds.includes(h.id)
                    return (
                      <button
                        key={h.id}
                        style={chipStyle(banned, '#f87171')}
                        onClick={() => setBannedHeroIds((prev) => prev.includes(h.id) ? prev.filter((id) => id !== h.id) : [...prev, h.id])}
                      >
                        {banned ? '✕ ' : ''}{h.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Generate & Import */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="ps-btn ps-btn-primary"
              style={{ padding: '5px 14px', fontSize: 11 }}
              onClick={handleGenerate}
              disabled={!selectedMap || disabled}
            >
              <Send size={11} /> Generate &amp; Import
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Invite Input Component ──

function InviteInput({ onInvite, disabled }: { onInvite: (tag: string, team: number) => void; disabled: boolean }) {
  const [tag, setTag] = useState('')
  const [team, setTeam] = useState(1)

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
      <input
        type="text"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="BattleTag#1234"
        disabled={disabled}
        style={{
          flex: 1,
          padding: '5px 10px',
          fontSize: 12,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          color: '#e2e8f0',
          outline: 'none',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && tag.trim()) {
            onInvite(tag.trim(), team)
            setTag('')
          }
        }}
      />
      <select
        value={team}
        onChange={(e) => setTeam(Number(e.target.value))}
        disabled={disabled}
        style={{
          padding: '5px 10px',
          fontSize: 13,
          fontWeight: 600,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          color: '#e2e8f0',
        }}
      >
        <option value={1}>T1</option>
        <option value={2}>T2</option>
        <option value={0}>Spec</option>
      </select>
      <button
        className="ps-btn ps-btn-primary"
        style={{ padding: '5px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
        onClick={() => { if (tag.trim()) { onInvite(tag.trim(), team); setTag('') } }}
        disabled={disabled || !tag.trim()}
      >
        <UserPlus size={11} /> Invite
      </button>
    </div>
  )
}

// ── Player Roster Component ──

function PlayerRosterView({
  players,
  onReinvite,
  acting,
}: {
  players: PlayerRoster[]
  onReinvite?: (tag: string, team: number) => void
  acting: boolean
}) {
  if (players.length === 0) return null

  const t1 = players.filter((p) => p.team === 1)
  const t2 = players.filter((p) => p.team === 2)
  const other = players.filter((p) => p.team !== 1 && p.team !== 2)

  const renderPlayer = (p: PlayerRoster) => (
    <div
      key={p.battleTag ?? p.userId ?? Math.random()}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3px 0',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: PLAYER_STATUS_COLOR[p.status] ?? '#64748b',
          display: 'inline-block',
          flexShrink: 0,
        }} />
        <span style={{ color: '#e2e8f0' }}>{p.battleTag ?? `User ${p.userId}`}</span>
        <span style={{ color: '#475569', fontSize: 10 }}>{p.status}</span>
      </div>
      {onReinvite && p.battleTag && p.status !== 'joined' && (
        <button
          className="ps-btn ps-btn-ghost"
          style={{ padding: '1px 6px', fontSize: 10 }}
          onClick={() => onReinvite(p.battleTag!, p.team ?? 1)}
          disabled={acting}
        >
          Re-invite
        </button>
      )}
    </div>
  )

  return (
    <div style={{
      padding: '8px 10px',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: 6,
      marginTop: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={11} /> Players ({players.filter((p) => p.status === 'joined').length}/{players.length})
      </div>
      {t1.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 500, marginBottom: 2 }}>Team 1</div>
          {t1.map(renderPlayer)}
        </div>
      )}
      {t2.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, color: '#f87171', fontWeight: 500, marginBottom: 2 }}>Team 2</div>
          {t2.map(renderPlayer)}
        </div>
      )}
      {other.length > 0 && other.map(renderPlayer)}
    </div>
  )
}

// ── Live Stats Panel ──

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function fmtStat(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function LiveStatsPanel({ stats }: { stats: LiveStats }) {
  const t1Players = Object.entries(stats.team1.players)
  const t2Players = Object.entries(stats.team2.players)
  const hasPlayers = t1Players.length > 0 || t2Players.length > 0

  const headerStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
  }

  const colStyle: React.CSSProperties = {
    fontSize: 11, padding: '3px 0', display: 'flex', alignItems: 'center',
  }

  const renderPlayer = ([name, p]: [string, LivePlayerStats]) => (
    <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 28px 28px 44px 44px', gap: 4, ...colStyle }}>
      <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ color: '#94a3b8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.hero}</span>
      <span style={{ color: '#4ade80', textAlign: 'right' }}>{p.finalBlows}</span>
      <span style={{ color: '#f87171', textAlign: 'right' }}>{p.deaths}</span>
      <span style={{ color: '#fbbf24', textAlign: 'right', fontSize: 10 }}>{fmtStat(p.damageDelt)}</span>
      <span style={{ color: '#34d399', textAlign: 'right', fontSize: 10 }}>{fmtStat(p.healingDealt)}</span>
    </div>
  )

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(0,0,0,0.25)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Match header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gamepad2 size={12} style={{ color: '#94a3b8' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            {stats.map ?? 'Unknown Map'}
          </span>
          {stats.mapType && (
            <span style={{ fontSize: 10, color: '#64748b', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
              {stats.mapType}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b' }}>
          {stats.round > 0 && <span>R{stats.round}</span>}
          <span>{fmtTime(stats.matchTime)}</span>
          {stats.matchEnded && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
              color: stats.matchResult === 'team1' ? '#60a5fa' : stats.matchResult === 'team2' ? '#f87171' : '#facc15',
              background: stats.matchResult === 'team1' ? 'rgba(96,165,250,0.15)' : stats.matchResult === 'team2' ? 'rgba(248,113,113,0.15)' : 'rgba(250,204,21,0.15)',
            }}>
              {stats.matchResult === 'team1' ? 'T1 Win' : stats.matchResult === 'team2' ? 'T2 Win' : 'Draw'}
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16,
        padding: '6px 0', marginBottom: 8,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{stats.team1.name}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.1em' }}>
          {stats.team1.score} — {stats.team2.score}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{stats.team2.name}</span>
      </div>

      {hasPlayers && (
        <>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 28px 28px 44px 44px', gap: 4, ...headerStyle, color: '#475569' }}>
            <span>Player</span>
            <span>Hero</span>
            <span style={{ textAlign: 'right' }}>K</span>
            <span style={{ textAlign: 'right' }}>D</span>
            <span style={{ textAlign: 'right' }}>Dmg</span>
            <span style={{ textAlign: 'right' }}>Heal</span>
          </div>

          {/* Team 1 */}
          {t1Players.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#60a5fa', marginBottom: 2, textTransform: 'uppercase' }}>
                {stats.team1.name}
              </div>
              {t1Players.map(renderPlayer)}
            </div>
          )}

          {/* Team 2 */}
          {t2Players.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#f87171', marginBottom: 2, textTransform: 'uppercase' }}>
                {stats.team2.name}
              </div>
              {t2Players.map(renderPlayer)}
            </div>
          )}
        </>
      )}

      {!hasPlayers && stats.eventCount > 0 && (
        <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: '8px 0' }}>
          {stats.eventCount} events tracked — waiting for player data...
        </div>
      )}
    </div>
  )
}

// ── Screenshot Viewer ──

function ScreenshotViewer({
  instanceId,
  onClose,
}: {
  instanceId: string
  onClose: () => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchScreenshot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pug/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot', instanceId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImageUrl(data.image)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch screenshot')
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  useEffect(() => { fetchScreenshot() }, [fetchScreenshot])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchScreenshot, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchScreenshot])

  return (
    <div style={{
      marginTop: 8,
      padding: 10,
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.08)',
    }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Camera size={12} /> Desktop Screenshot
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: 12, height: 12 }}
            />
            Auto (5s)
          </label>
          <button
            className="ps-btn ps-btn-ghost"
            style={{ padding: '2px 6px', fontSize: 10 }}
            onClick={fetchScreenshot}
            disabled={loading}
          >
            <RefreshCcw size={10} />
          </button>
          <button
            className="ps-btn ps-btn-ghost"
            style={{ padding: '2px 6px', fontSize: 10 }}
            onClick={onClose}
          >
            <X size={10} />
          </button>
        </div>
      </div>
      {loading && !imageUrl && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', color: '#64748b', fontSize: 12 }}>
          <Loader2 size={14} className="ps-spin" style={{ marginRight: 6 }} /> Loading screenshot...
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#f87171', padding: '8px 0' }}>{error}</div>
      )}
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Bot desktop screenshot"
          style={{
            width: '100%',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.06)',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        />
      )}
    </div>
  )
}

// ── Main Panel ──

export function PugBotTestingPanel() {
  const alert = useAlert()
  const confirm = useConfirm()
  const [health, setHealth] = useState<BotHealth>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const healthFailCount = React.useRef(0)
  const [instances, setInstances] = useState<BotInstance[]>([])
  const [instancePlayers, setInstancePlayers] = useState<Record<string, PlayerRoster[]>>({})
  const [lobbies, setLobbies] = useState<ActiveLobby[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [testToolsOpen, setTestToolsOpen] = useState(false)
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set())
  const [codeImport, setCodeImport] = useState<{ instanceId: string } | null>(null)
  const [importingInstanceId, setImportingInstanceId] = useState<string | null>(null)
  const [invitingInstanceId, setInvitingInstanceId] = useState<string | null>(null)
  const [screenshotInstanceId, setScreenshotInstanceId] = useState<string | null>(null)
  const [syncingInstanceId, setSyncingInstanceId] = useState<string | null>(null)
  const [pausedInstances, setPausedInstances] = useState<Set<string>>(new Set())
  const [testTagsInput, setTestTagsInput] = useState('')
  const [testLobbyRunning, setTestLobbyRunning] = useState(false)
  const [botHostingEnabled, setBotHostingEnabled] = useState<boolean | null>(null)
  const [togglingBotHosting, setTogglingBotHosting] = useState(false)

  const fetchBotHostingState = useCallback(async () => {
    try {
      const res = await fetch('/api/pug/bot-toggle', { credentials: 'include' })
      const data = await res.json()
      if (typeof data?.botEnabled === 'boolean') setBotHostingEnabled(data.botEnabled)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchBotHostingState() }, [fetchBotHostingState])

  async function toggleBotHosting() {
    if (botHostingEnabled === null) return
    const next = !botHostingEnabled
    const confirmed = await confirm({
      message: next
        ? 'Re-enable bot hosting?'
        : 'Switch to manual hosting mode? New lobbies will require human hosts.',
      variant: next ? 'default' : 'danger',
    })
    if (!confirmed) return
    setTogglingBotHosting(true)
    try {
      const res = await fetch('/api/pug/bot-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        await alert({ message: data.error || 'Failed to toggle bot hosting', variant: 'danger' })
      } else if (typeof data?.botEnabled === 'boolean') {
        setBotHostingEnabled(data.botEnabled)
      }
    } catch (err: any) {
      await alert({ message: err.message, variant: 'danger' })
    } finally {
      setTogglingBotHosting(false)
    }
  }

  const checkHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/pug/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'botHealth' }),
        credentials: 'include',
      })
      const data = await res.json()
      healthFailCount.current = 0
      setHealth(data)
    } catch {
      // Only mark as unreachable after 2+ consecutive failures
      // (bot may be briefly busy during OW launch)
      healthFailCount.current += 1
      if (healthFailCount.current >= 2) {
        setHealth({ reachable: false, error: 'Request failed' })
      }
    } finally {
      setHealthLoading(false)
      setLastChecked(new Date())
    }
  }, [])

  const fetchInstances = useCallback(async () => {
    try {
      const res = await fetch('/api/pug/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listInstances' }),
        credentials: 'include',
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setInstances(data)
        // Fetch players for active instances
        for (const inst of data) {
          if (inst.playerCount > 0 && inst.pugLobbyId) {
            fetchPlayersForLobby(inst.pugLobbyId, inst.id)
          } else if (inst.playerCount > 0) {
            fetchPlayersForInstance(inst.id)
          }
        }
      }
      // On failure, keep existing instance data (don't clear on transient errors)
    } catch { /* keep existing data */ }
  }, [])

  const fetchPlayersForLobby = async (pugLobbyId: number, instanceId: string) => {
    try {
      const res = await fetch('/api/pug/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lobbyPlayers', pugLobbyId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setInstancePlayers((prev) => ({ ...prev, [instanceId]: data }))
      }
    } catch { /* ignore */ }
  }

  const fetchPlayersForInstance = async (instanceId: string) => {
    try {
      const res = await fetch('/api/pug/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'instancePlayers', instanceId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setInstancePlayers((prev) => ({ ...prev, [instanceId]: data }))
      }
    } catch { /* ignore */ }
  }

  const fetchLobbies = useCallback(async () => {
    try {
      const [openRes, inviteRes] = await Promise.all([
        fetch('/api/pug/lobby?tier=open'),
        fetch('/api/pug/lobby?tier=invite'),
      ])
      const openData = openRes.ok ? await openRes.json() : { lobbies: [] }
      const inviteData = inviteRes.ok ? await inviteRes.json() : { lobbies: [] }
      setLobbies([...openData.lobbies, ...inviteData.lobbies] as ActiveLobby[])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { checkHealth(); fetchInstances(); fetchLobbies() }, [checkHealth, fetchInstances, fetchLobbies])

  useEffect(() => {
    const interval = setInterval(() => { checkHealth(); fetchInstances() }, 10000)
    const lobbyInterval = setInterval(fetchLobbies, 10000)
    return () => { clearInterval(interval); clearInterval(lobbyInterval) }
  }, [checkHealth, fetchInstances, fetchLobbies])

  /** Optimistically update an instance's state in the UI before the API responds. */
  function optimisticUpdate(instanceId: string, newState: string) {
    setInstances((prev) => prev.map((i) => i.id === instanceId ? { ...i, state: newState } : i))
  }

  async function botAction(body: Record<string, any>, actionKey?: string, optimistic?: { instanceId: string; state: string }) {
    const key = actionKey ?? body.action + (body.pugLobbyId ?? '') + (body.instanceId ?? '')
    setActing(key)
    setLastResult(null)
    if (optimistic) optimisticUpdate(optimistic.instanceId, optimistic.state)
    try {
      const res = await fetch('/api/pug/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        await alert({ message: data.error || 'Action failed', variant: 'danger' })
      } else {
        setLastResult(JSON.stringify(data, null, 2))
      }
      await Promise.all([fetchInstances(), fetchLobbies()])
      return data
    } catch (err: any) {
      await alert({ message: err.message, variant: 'danger' })
    } finally {
      setActing(null)
    }
  }

  function toggleExpanded(instanceId: string) {
    setExpandedInstances((prev) => {
      const next = new Set(prev)
      if (next.has(instanceId)) next.delete(instanceId)
      else next.add(instanceId)
      return next
    })
  }

  const inProgressLobbies = lobbies.filter((l) => ['IN_PROGRESS', 'REPORTING', 'DISPUTED'].includes(l.status))
  const banningLobbies = lobbies.filter((l) => l.status === 'BANNING')
  const isConnected = health?.reachable && !health.authError

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <div className="ps-header">
        <h1 className="ps-title">Bot Management</h1>
      </div>

      {/* Bot Hosting Kill-Switch */}
      <div className="ps-section">
        <div style={{
          padding: '14px 20px',
          borderRadius: 12,
          border: '1px solid',
          borderColor: botHostingEnabled === null
            ? 'rgba(255,255,255,0.07)'
            : botHostingEnabled ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.3)',
          background: botHostingEnabled === null
            ? 'rgba(255,255,255,0.02)'
            : botHostingEnabled ? 'rgba(74,222,128,0.05)' : 'rgba(248,113,113,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {botHostingEnabled === null ? (
              <Loader2 size={18} style={{ color: '#64748b' }} className="ps-spin" />
            ) : botHostingEnabled ? (
              <Bot size={18} style={{ color: '#4ade80' }} />
            ) : (
              <PowerOff size={18} style={{ color: '#f87171' }} />
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                {botHostingEnabled === null
                  ? 'Bot hosting: …'
                  : botHostingEnabled
                    ? <span style={{ color: '#4ade80' }}>Bot hosting: ENABLED</span>
                    : <span style={{ color: '#f87171' }}>Bot hosting: DISABLED — manual mode</span>}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {botHostingEnabled === false
                  ? 'New lobbies skip the bot and require a human host.'
                  : 'New lobbies are hosted automatically by the bot.'}
              </div>
            </div>
          </div>
          <button
            className={`ps-btn ${botHostingEnabled ? 'ps-btn-danger' : 'ps-btn-success'}`}
            style={{ padding: '6px 16px', fontSize: 12, whiteSpace: 'nowrap' }}
            onClick={toggleBotHosting}
            disabled={botHostingEnabled === null || togglingBotHosting}
          >
            {togglingBotHosting ? (
              <Loader2 size={12} className="ps-spin" />
            ) : botHostingEnabled ? (
              <><PowerOff size={12} /> Disable bot hosting</>
            ) : (
              <><Power size={12} /> Enable bot hosting</>
            )}
          </button>
        </div>
      </div>

      {/* Connection Banner */}
      <div className="ps-section">
        <div style={{
          padding: '14px 20px',
          borderRadius: 12,
          border: '1px solid',
          borderColor: isConnected
            ? 'rgba(74,222,128,0.2)'
            : health?.reachable ? 'rgba(250,204,21,0.2)' : health === null ? 'rgba(255,255,255,0.07)' : 'rgba(248,113,113,0.2)',
          background: isConnected
            ? 'rgba(74,222,128,0.04)'
            : health?.reachable ? 'rgba(250,204,21,0.04)' : 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {health === null ? (
              <Loader2 size={18} style={{ color: '#64748b' }} className="ps-spin" />
            ) : isConnected ? (
              <Wifi size={18} style={{ color: '#4ade80' }} />
            ) : health.reachable ? (
              <AlertTriangle size={18} style={{ color: '#facc15' }} />
            ) : (
              <WifiOff size={18} style={{ color: '#f87171' }} />
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
              {health === null ? 'Connecting...' : isConnected ? 'Connected' : health.reachable ? 'Auth Mismatch' : 'Unreachable'}
            </span>
            {isConnected && instances.length > 0 && (() => {
              const idle = instances.filter((i) => i.state === 'available').length
              const ready = instances.filter((i) => i.state === 'ready').length
              const warming = instances.filter((i) => i.state === 'warming_up').length
              const inGame = instances.filter((i) => ['creating_lobby', 'waiting_for_players', 'in_game'].includes(i.state)).length
              const errored = instances.filter((i) => i.state === 'error').length
              return (
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
                  <span>{instances.length} instance{instances.length !== 1 ? 's' : ''}</span>
                  {idle > 0 && <span>{idle} idle</span>}
                  {ready > 0 && <span style={{ color: '#2dd4bf' }}>{ready} ready</span>}
                  {warming > 0 && <span style={{ color: '#60a5fa' }}>{warming} warming</span>}
                  {inGame > 0 && <span style={{ color: '#f97316' }}>{inGame} in game</span>}
                  {errored > 0 && <span style={{ color: '#f87171' }}>{errored} error</span>}
                </div>
              )
            })()}
            {health?.authError && (
              <span style={{ fontSize: 12, color: '#facc15', marginLeft: 8 }}>
                OW_BOT_SECRET doesn&apos;t match bot&apos;s secret
              </span>
            )}
            {health && !health.reachable && health.error && (
              <span style={{ fontSize: 12, color: '#f87171', marginLeft: 8 }}>{health.error}</span>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
            {healthLoading ? '...' : lastChecked ? <TimeAgo date={lastChecked} /> : ''}
          </span>
        </div>
      </div>

      {/* Bot Instances */}
      <div className="ps-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p className="ps-section-title" style={{ margin: 0 }}>Bot Instances</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {isConnected && instances.some((i) => i.state === 'available' || i.state === 'ready') && (
              <button
                className="ps-btn ps-btn-ghost"
                style={{ padding: '4px 12px', fontSize: 11 }}
                onClick={() => botAction({ action: 'shutdownIdle' }, 'shutdownIdle')}
                disabled={acting !== null}
              >
                <PowerOff size={11} /> Shutdown Idle
              </button>
            )}
            {isConnected && (
              <button
                className="ps-btn ps-btn-danger"
                style={{ padding: '4px 12px', fontSize: 11 }}
                onClick={async () => {
                  const confirmed = await confirm({ message: 'Kill all OW processes and reset all instances to Available?', variant: 'danger' })
                  if (confirmed) botAction({ action: 'forceResetAll' }, 'forceResetAll')
                }}
                disabled={acting !== null}
              >
                <RotateCcw size={11} /> Force Reset All
              </button>
            )}
            {isConnected && (
              <button
                className="ps-btn ps-btn-ghost"
                style={{ padding: '4px 12px', fontSize: 11 }}
                onClick={async () => {
                  const confirmed = await confirm({ message: 'Restart the bot service? It will be unavailable for a few seconds.', variant: 'danger' })
                  if (confirmed) botAction({ action: 'restartService' }, 'restartService')
                }}
                disabled={acting !== null}
              >
                <ServerCrash size={11} /> Restart Service
              </button>
            )}
          </div>
        </div>

        {!isConnected && instances.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            {health === null ? 'Connecting to bot service...' : 'Bot service unavailable'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {instances.map((inst) => {
              const stateConf = getStateConfig(inst.state)
              const displayName = getDisplayName(inst)
              const isImporting = importingInstanceId === inst.id
              const isInviting = invitingInstanceId === inst.id
              const isWorking = inst.state === 'warming_up' || inst.state === 'creating_lobby' || isImporting || isInviting
              const isInLobby = inst.state === 'waiting_for_players' || inst.state === 'in_game' || inst.state === 'creating_lobby'
              const isError = inst.state === 'error'
              const isIdle = inst.state === 'available'
              const isReady = inst.state === 'ready'
              const expanded = expandedInstances.has(inst.id)
              const players = instancePlayers[inst.id] ?? []

              return (
                <div key={inst.id} style={{
                  padding: 16,
                  borderRadius: 12,
                  border: `1px solid ${stateConf.color}22`,
                  background: stateConf.bg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  {/* Header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => toggleExpanded(inst.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Bot size={18} style={{ color: stateConf.color }} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
                        {displayName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="ps-btn ps-btn-ghost"
                        style={{ padding: '3px 6px', fontSize: 10, opacity: 0.6 }}
                        onClick={async (e) => {
                          e.stopPropagation()
                          setSyncingInstanceId(inst.id)
                          try {
                            const res = await fetch('/api/pug/bot/test', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'syncInstance', instanceId: inst.id }),
                              credentials: 'include',
                            })
                            const data = await res.json()
                            if (data.ok) {
                              fetchInstances()
                            } else {
                              await alert({ message: data.error || 'Sync failed', variant: 'danger' })
                            }
                          } catch (err: any) {
                            await alert({ message: err.message, variant: 'danger' })
                          } finally {
                            setSyncingInstanceId(null)
                          }
                        }}
                        title="Detect actual OW screen and sync state"
                        disabled={syncingInstanceId === inst.id}
                      >
                        {syncingInstanceId === inst.id ? <Loader2 size={12} className="ps-spin" /> : <ScanLine size={12} />}
                      </button>
                      <button
                        className="ps-btn ps-btn-ghost"
                        style={{ padding: '3px 6px', fontSize: 10, opacity: 0.6 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setScreenshotInstanceId(screenshotInstanceId === inst.id ? null : inst.id)
                        }}
                        title="View desktop screenshot"
                      >
                        <Camera size={12} />
                      </button>
                      <span style={{
                        fontSize: 11, fontWeight: 500, color: stateConf.color,
                        padding: '3px 10px', background: `${stateConf.color}18`, borderRadius: 6,
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        {isWorking && <Loader2 size={10} className="ps-spin" />}
                        {syncingInstanceId === inst.id ? 'Scanning...' : isInviting ? 'Inviting Player...' : isImporting ? 'Importing Code...' : stateConf.label}
                      </span>
                      {expanded ? <ChevronDown size={14} style={{ color: '#475569' }} /> : <ChevronRight size={14} style={{ color: '#475569' }} />}
                    </div>
                  </div>

                  {/* Status detail — shows what the bot is actively doing */}
                  {(inst.statusDetail || isImporting || isInviting) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', fontSize: 12, color: '#94a3b8',
                      background: 'rgba(0,0,0,0.15)', borderRadius: 6,
                    }}>
                      <Loader2 size={11} className="ps-spin" style={{ color: stateConf.color, flexShrink: 0 }} />
                      <span>{isInviting ? 'Sending invite in Overwatch - this takes up to 2 minutes…' : isImporting ? 'Importing settings code…' : inst.statusDetail}</span>
                    </div>
                  )}

                  {/* Step-by-step workflow hint */}
                  {inst.state === 'creating_lobby' && !isImporting && !inst.statusDetail && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', fontSize: 12, color: '#facc15',
                      background: 'rgba(250,204,21,0.06)', borderRadius: 6,
                      border: '1px solid rgba(250,204,21,0.12)',
                    }}>
                      <CheckCircle2 size={11} style={{ flexShrink: 0 }} />
                      <span>Custom game created. Next: Import Code, Invite Players, or Start Game</span>
                    </div>
                  )}
                  {inst.state === 'ready' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', fontSize: 12, color: '#2dd4bf',
                      background: 'rgba(45,212,191,0.06)', borderRadius: 6,
                      border: '1px solid rgba(45,212,191,0.12)',
                    }}>
                      <Zap size={11} style={{ flexShrink: 0 }} />
                      <span>Instance warmed up. Click Create Game to open a custom lobby</span>
                    </div>
                  )}

                  {/* Lobby info */}
                  {inst.pugLobbyId && (
                    <div style={{
                      fontSize: 12, color: '#94a3b8', padding: '6px 10px',
                      background: 'rgba(0,0,0,0.2)', borderRadius: 6,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Monitor size={12} />
                      <span>PUG #{inst.lobbyNumber ?? inst.pugLobbyId}</span>
                      {inst.playerCount !== undefined && inst.playerCount > 0 && (
                        <span style={{ marginLeft: 'auto', color: '#64748b' }}>
                          <Users size={10} style={{ display: 'inline', marginRight: 3 }} />
                          {inst.playerCount} players
                        </span>
                      )}
                    </div>
                  )}

                  {/* Live stats — shown during in_game */}
                  {(inst.state === 'in_game' || inst.state === 'post_game') && inst.liveStats && (
                    <LiveStatsPanel stats={inst.liveStats} />
                  )}

                  {/* Actions — always visible */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* Idle: Warmup */}
                    {isIdle && (
                      <button
                        className="ps-btn ps-btn-primary"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          botAction({ action: 'warmup' }, `warmup-${inst.id}`, { instanceId: inst.id, state: 'warming_up' })
                        }}
                        disabled={acting !== null}
                      >
                        <Power size={11} /> Warmup
                      </button>
                    )}

                    {/* Ready: Manual step controls */}
                    {isReady && (
                      <button
                        className="ps-btn ps-btn-primary"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); botAction({ action: 'instanceStep', instanceId: inst.id, command: 'create_custom_game' }) }}
                        disabled={acting !== null}
                      >
                        <Gamepad2 size={11} /> Create Game
                      </button>
                    )}

                    {/* In lobby: Import / Start */}
                    {(inst.state === 'waiting_for_players' || inst.state === 'creating_lobby') && (
                      <>
                        <button
                          className="ps-btn ps-btn-ghost"
                          style={{ padding: '5px 12px', fontSize: 11 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setCodeImport(codeImport?.instanceId === inst.id ? null : { instanceId: inst.id })
                          }}
                          disabled={acting !== null || isImporting}
                        >
                          <Code size={11} /> Import Code
                        </button>
                        <button
                          className="ps-btn ps-btn-success"
                          style={{ padding: '5px 12px', fontSize: 11 }}
                          onClick={(e) => { e.stopPropagation(); botAction({ action: 'instanceStep', instanceId: inst.id, command: 'start_game' }) }}
                          disabled={acting !== null}
                        >
                          <Play size={11} /> Start Game
                        </button>
                      </>
                    )}

                    {/* In game: Pause / End */}
                    {inst.state === 'in_game' && (
                      <>
                        <button
                          className={pausedInstances.has(inst.id) ? 'ps-btn ps-btn-success' : 'ps-btn ps-btn-warning'}
                          style={{ padding: '5px 12px', fontSize: 11 }}
                          onClick={async (e) => {
                            e.stopPropagation()
                            const cmd = pausedInstances.has(inst.id) ? 'unpause' : 'pause'
                            const result = inst.pugLobbyId
                              ? await botAction({ action: 'lobbyCommand', pugLobbyId: inst.pugLobbyId, command: cmd })
                              : await botAction({ action: 'instanceStep', instanceId: inst.id, command: cmd })
                            if (result?.ok) {
                              setPausedInstances(prev => {
                                const next = new Set(prev)
                                if (cmd === 'pause') next.add(inst.id)
                                else next.delete(inst.id)
                                return next
                              })
                            }
                          }}
                          disabled={acting !== null}
                        >
                          {pausedInstances.has(inst.id) ? <><Play size={11} /> Unpause</> : <><Pause size={11} /> Pause</>}
                        </button>
                        <button
                          className="ps-btn"
                          style={{ padding: '5px 12px', fontSize: 11, background: '#2563eb', color: '#fff' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            botAction({ action: 'instanceStep', instanceId: inst.id, command: 'end_team1' })
                          }}
                          disabled={acting !== null}
                        >
                          T1 Wins
                        </button>
                        <button
                          className="ps-btn"
                          style={{ padding: '5px 12px', fontSize: 11, background: '#dc2626', color: '#fff' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            botAction({ action: 'instanceStep', instanceId: inst.id, command: 'end_team2' })
                          }}
                          disabled={acting !== null}
                        >
                          T2 Wins
                        </button>
                        <button
                          className="ps-btn ps-btn-ghost"
                          style={{ padding: '5px 12px', fontSize: 11 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            botAction({ action: 'instanceStep', instanceId: inst.id, command: 'end_draw' })
                          }}
                          disabled={acting !== null}
                        >
                          Draw
                        </button>
                      </>
                    )}

                    {/* Cancel for any lobby state */}
                    {isInLobby && inst.pugLobbyId && (
                      <button
                        className="ps-btn ps-btn-ghost"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); botAction({ action: 'cancelBotLobby', pugLobbyId: inst.pugLobbyId }) }}
                        disabled={acting !== null}
                      >
                        Cancel Lobby
                      </button>
                    )}

                    {/* Reset for step-by-step testing (no pugLobbyId) */}
                    {(isInLobby || inst.state === 'in_game' || inst.state === 'post_game') && !inst.pugLobbyId && (
                      <button
                        className="ps-btn ps-btn-ghost"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          botAction({ action: 'recoverInstance', instanceId: inst.id }, undefined, { instanceId: inst.id, state: 'available' })
                        }}
                        disabled={acting !== null}
                      >
                        <RotateCcw size={11} /> Reset Instance
                      </button>
                    )}

                    {/* Error: Recover */}
                    {isError && (
                      <button
                        className="ps-btn ps-btn-warning"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          botAction({ action: 'recoverInstance', instanceId: inst.id }, undefined, { instanceId: inst.id, state: 'available' })
                        }}
                        disabled={acting !== null}
                      >
                        <RefreshCw size={11} /> Recover
                      </button>
                    )}

                    {/* Idle/Ready: Shutdown */}
                    {(isIdle || isReady) && (
                      <button
                        className="ps-btn ps-btn-ghost"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); botAction({ action: 'shutdownInstance', instanceId: inst.id }) }}
                        disabled={acting !== null}
                      >
                        <PowerOff size={11} /> Shutdown
                      </button>
                    )}
                  </div>

                  {/* Code import — settings generator or manual paste */}
                  {codeImport?.instanceId === inst.id && (
                    <CodeImportPanel
                      onImport={async (code, meta) => {
                        setCodeImport(null)
                        setImportingInstanceId(inst.id)
                        try {
                          await botAction({ action: 'instanceStep', instanceId: inst.id, command: 'import_code', code, ...meta })
                        } finally {
                          setImportingInstanceId(null)
                        }
                      }}
                      onCancel={() => setCodeImport(null)}
                      disabled={acting !== null}
                    />
                  )}

                  {/* Player roster + invite — always visible when in lobby */}
                  {isInLobby && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      {players.length > 0 && (
                        <PlayerRosterView
                          players={players}
                          onReinvite={inst.pugLobbyId ? (tag, team) => {
                            botAction({ action: 'inviteToLobby', pugLobbyId: inst.pugLobbyId, battleTag: tag, team })
                          } : undefined}
                          acting={acting !== null}
                        />
                      )}
                      <InviteInput
                        onInvite={async (tag, team) => {
                          setInvitingInstanceId(inst.id)
                          try {
                            const body = inst.pugLobbyId
                              ? { action: 'inviteToLobby', pugLobbyId: inst.pugLobbyId, battleTag: tag, team }
                              : { action: 'instanceStep', instanceId: inst.id, command: 'invite_players', players: [{ userId: 0, battleTag: tag, team }] }
                            const res = await fetch('/api/pug/bot/test', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(body),
                              credentials: 'include',
                            })
                            const result = await res.json()
                            if (!res.ok || result.error) {
                              await alert({ message: result.error || 'Invite failed', variant: 'danger' })
                            } else {
                              await alert({ message: 'Invite sent in Overwatch', variant: 'info' })
                            }
                            fetchInstances()
                          } catch (err: any) {
                            await alert({ message: err.message, variant: 'danger' })
                          } finally {
                            setInvitingInstanceId(null)
                          }
                        }}
                        disabled={acting !== null}
                      />
                    </div>
                  )}

                  {/* Screenshot viewer */}
                  {screenshotInstanceId === inst.id && (
                    <ScreenshotViewer
                      instanceId={inst.id}
                      onClose={() => setScreenshotInstanceId(null)}
                    />
                  )}

                  {/* Expanded: extra details */}
                  {expanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        {inst.id} &middot; {inst.account}
                        {inst.workshopCode && <span> &middot; Code loaded</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Testing Tools (collapsible) */}
      <div className="ps-section">
        <button
          onClick={() => setTestToolsOpen(!testToolsOpen)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          }}
        >
          <p className="ps-section-title" style={{ margin: 0 }}>Testing Tools</p>
          {testToolsOpen ? <ChevronDown size={14} style={{ color: '#64748b' }} /> : <ChevronRight size={14} style={{ color: '#64748b' }} />}
        </button>

        {testToolsOpen && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="ps-btn ps-btn-primary"
                  onClick={() => botAction({ action: 'fillAndAdvance' })}
                  disabled={acting === 'fillAndAdvance'}
                  style={{ padding: '10px 20px', fontSize: 13 }}
                >
                  {acting === 'fillAndAdvance' ? (
                    <><Loader2 size={14} className="ps-spin" /> Running...</>
                  ) : (
                    <><Zap size={14} /> Fill &amp; Advance to IN_PROGRESS</>
                  )}
                </button>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Creates a lobby, fills with 10 dummies, advances through all phases.
                </span>
              </div>
            </div>

            {/* Start Test Lobby with BattleTags */}
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gamepad2 size={14} /> Start Test Lobby
              </p>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                Enter BattleTags (one per line). First half = Team 1, second half = Team 2. The bot will create a custom game, import settings, and invite everyone.
              </p>
              <textarea
                value={testTagsInput}
                onChange={(e) => setTestTagsInput(e.target.value)}
                placeholder={'Player1#1234\nPlayer2#5678\nPlayer3#9012\n...'}
                style={{
                  width: '100%', minHeight: 120, padding: 10, borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                <button
                  className="ps-btn ps-btn-primary"
                  disabled={testLobbyRunning || !testTagsInput.trim()}
                  onClick={async () => {
                    const tags = testTagsInput.trim().split('\n').map(t => t.trim()).filter(Boolean)
                    if (tags.length < 2) { alert({ message: 'Need at least 2 BattleTags' }); return }
                    if (tags.length > 10) { alert({ message: 'Max 10 BattleTags' }); return }
                    setTestLobbyRunning(true)
                    try {
                      const res = await fetch('/api/pug/bot/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'startTestLobby', battleTags: tags }),
                        credentials: 'include',
                      })
                      const data = await res.json()
                      setLastResult(JSON.stringify(data, null, 2))
                      if (data.ok) {
                        fetchInstances()
                        fetchLobbies()
                      }
                    } catch (err: any) {
                      setLastResult(`Error: ${err.message}`)
                    } finally {
                      setTestLobbyRunning(false)
                    }
                  }}
                  style={{ padding: '10px 20px', fontSize: 13 }}
                >
                  {testLobbyRunning ? (
                    <><Loader2 size={14} className="ps-spin" /> Starting...</>
                  ) : (
                    <><Play size={14} /> Start Test Lobby ({testTagsInput.trim().split('\n').filter(t => t.trim()).length} players)</>
                  )}
                </button>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {(() => {
                    const tags = testTagsInput.trim().split('\n').filter(t => t.trim())
                    const half = Math.ceil(tags.length / 2)
                    return tags.length >= 2 ? `T1: ${half} / T2: ${tags.length - half}` : ''
                  })()}
                </span>
              </div>
            </div>

            {(inProgressLobbies.length > 0 || banningLobbies.length > 0) ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Simulate Bot Callbacks</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...inProgressLobbies, ...banningLobbies].map((lobby) => (
                    <div key={lobby.id} style={{
                      padding: 14, borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>PUG #{lobby.lobbyNumber}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', padding: '2px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>{lobby.status}</span>
                        {lobby.botStatus && (
                          <span style={{ fontSize: 11, color: '#a78bfa', padding: '2px 8px', background: 'rgba(139,92,246,0.1)', borderRadius: 4 }}>Bot: {lobby.botStatus}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {BOT_STATUSES.map((s) => (
                          <button key={s} className={`ps-btn ${s === 'error' ? 'ps-btn-danger' : 'ps-btn-ghost'}`} style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => botAction({ action: 'simulateStatus', pugLobbyId: lobby.id, status: s })} disabled={acting !== null}
                          >{s}</button>
                        ))}
                        {lobby.status === 'IN_PROGRESS' && (
                          <>
                            <span style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', margin: '0 2px' }} />
                            <button className="ps-btn ps-btn-success" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => botAction({ action: 'simulateStats', pugLobbyId: lobby.id, result: 'team1' })} disabled={acting !== null}
                            ><CheckCircle2 size={10} /> T1 Won</button>
                            <button className="ps-btn ps-btn-warning" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => botAction({ action: 'simulateStats', pugLobbyId: lobby.id, result: 'team2' })} disabled={acting !== null}
                            ><CheckCircle2 size={10} /> T2 Won</button>
                            <button className="ps-btn ps-btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => botAction({ action: 'simulateStats', pugLobbyId: lobby.id, result: 'draw' })} disabled={acting !== null}
                            >Draw</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: '#475569', fontSize: 12 }}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />
                No lobbies in BANNING or IN_PROGRESS. Use Fill &amp; Advance to create one.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last result */}
      {lastResult && (
        <div className="ps-section">
          <p className="ps-section-title">Last Result</p>
          <pre style={{
            padding: 14, borderRadius: 8, background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.07)', fontSize: 12,
            color: '#94a3b8', overflow: 'auto', maxHeight: 180,
          }}>{lastResult}</pre>
        </div>
      )}
    </div>
  )
}
