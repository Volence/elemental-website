'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Gamepad2, Power, PowerOff, ExternalLink, XCircle, Loader2, Users, Clock, Trophy, SkipForward, AlertTriangle, ChevronDown, ChevronUp, UserMinus, ArrowRightLeft, Shield } from 'lucide-react'
import { PUG_ADMIN_CSS, timeAgo } from '@/components/pugAdminStyles'
import { useConfirm, useAlert } from '@/components/ConfirmDialog'

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  flex_dps: 'Flex DPS',
  hitscan_dps: 'Hitscan DPS',
  flex_support: 'Flex Sup',
  main_support: 'Main Sup',
}

const ROLE_COLORS: Record<string, string> = {
  tank: '#60a5fa',
  flex_dps: '#f87171',
  hitscan_dps: '#fb923c',
  flex_support: '#4ade80',
  main_support: '#2dd4bf',
}

type Player = {
  id: number
  userId: number
  name?: string
  avatarUrl?: string | null
  team?: number | null
  isCaptain?: boolean
  readyConfirmed?: boolean
  assignedRole?: string | null
  queuedRoles?: string[]
}

type Lobby = {
  id: number
  lobbyNumber: number
  tier: string
  region?: string | null
  status: string
  createdAt: string
  timeoutAt?: string | null
  players: Player[]
  draftState?: { currentPickTeam: number; captain1Id: number; captain2Id: number; pickNumber: number } | null
  banState?: { currentBanTeam: number; banNumber: number; bans: any[] } | null
  mapVote?: { candidates: number[]; votes: Record<string, number>; selectedMapId?: number | null } | null
  pendingResult?: { result: string; reportedBy: number } | null
}

type RegionStatus = Record<string, boolean>

const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
]

const STATUS_CLASSES: Record<string, string> = {
  OPEN: 'ps-status-open',
  READY: 'ps-status-ready',
  DRAFTING: 'ps-status-drafting',
  MAP_VOTE: 'ps-status-map_vote',
  BANNING: 'ps-status-banning',
  IN_PROGRESS: 'ps-status-in_progress',
  REPORTING: 'ps-status-reporting',
  DISPUTED: 'ps-status-disputed',
}

const ALL_STATUSES = ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING', 'COMPLETED', 'CANCELLED', 'DISPUTED']
const ALL_ROLES = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

function GraceCountdown({ timeoutAt }: { timeoutAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(timeoutAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timeoutAt])

  return <span style={{ color: '#facc15', fontSize: 12, fontFamily: 'monospace' }}>{remaining}</span>
}

function LobbyExpanded({ lobby, onAction, acting }: {
  lobby: Lobby
  onAction: (lobbyId: number, path: string, body: Record<string, any>) => Promise<void>
  acting: string | null
}) {
  const confirm = useConfirm()
  const team1 = lobby.players.filter((p) => p.team === 1)
  const team2 = lobby.players.filter((p) => p.team === 2)
  const unassigned = lobby.players.filter((p) => p.team == null)

  async function adminAction(action: string, extra: Record<string, any> = {}) {
    await onAction(lobby.id, '/admin', { action, ...extra })
  }

  function PlayerRow({ p }: { p: Player }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {p.avatarUrl ? (
          <img src={p.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            {(p.name ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
        <span style={{ flex: 1, fontSize: 13, color: '#e2e8f0', minWidth: 0 }}>
          {p.name ?? `Player #${p.userId}`}
          {p.isCaptain && <span style={{ marginLeft: 6, fontSize: 10, color: '#facc15' }}>(C)</span>}
        </span>
        {p.assignedRole && (
          <span style={{ fontSize: 11, color: ROLE_COLORS[p.assignedRole] ?? '#94a3b8', flexShrink: 0 }}>
            {ROLE_LABELS[p.assignedRole] ?? p.assignedRole}
          </span>
        )}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {p.team !== 1 && (
            <button
              className="ps-btn ps-btn-ghost"
              style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={() => adminAction('swapTeam', { userId: p.userId, team: 1 })}
              title="Move to Team 1"
            >
              T1
            </button>
          )}
          {p.team !== 2 && (
            <button
              className="ps-btn ps-btn-ghost"
              style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={() => adminAction('swapTeam', { userId: p.userId, team: 2 })}
              title="Move to Team 2"
            >
              T2
            </button>
          )}
          <button
            className="ps-btn ps-btn-ghost"
            style={{ padding: '2px 6px', fontSize: 10, color: p.isCaptain ? '#facc15' : undefined }}
            onClick={() => adminAction('setCaptain', { userId: p.userId, isCaptain: !p.isCaptain })}
            title={p.isCaptain ? 'Remove captain' : 'Make captain'}
          >
            <Shield size={10} />
          </button>
          <select
            style={{ padding: '1px 4px', fontSize: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#94a3b8', cursor: 'pointer' }}
            value={p.assignedRole ?? ''}
            onChange={(e) => adminAction('setRole', { userId: p.userId, assignedRole: e.target.value || null })}
          >
            <option value="">No role</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            className="ps-btn ps-btn-danger"
            style={{ padding: '2px 6px', fontSize: 10 }}
            onClick={async () => { if (await confirm({ message: `Kick ${p.name}?`, variant: 'danger' })) adminAction('kick', { userId: p.userId }) }}
            title="Kick player"
          >
            <UserMinus size={10} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Players */}
      <div style={{ display: 'grid', gridTemplateColumns: unassigned.length > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Team 1 ({team1.length})
          </div>
          {team1.length === 0 && <div style={{ fontSize: 12, color: '#334155' }}>No players</div>}
          {team1.map((p) => <PlayerRow key={p.userId} p={p} />)}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Team 2 ({team2.length})
          </div>
          {team2.length === 0 && <div style={{ fontSize: 12, color: '#334155' }}>No players</div>}
          {team2.map((p) => <PlayerRow key={p.userId} p={p} />)}
        </div>
        {unassigned.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Unassigned ({unassigned.length})
            </div>
            {unassigned.map((p) => <PlayerRow key={p.userId} p={p} />)}
          </div>
        )}
      </div>

      {/* Phase info */}
      {lobby.status === 'DRAFTING' && lobby.draftState && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, marginBottom: 4 }}>Draft Phase</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Pick #{lobby.draftState.pickNumber + 1} - Team {lobby.draftState.currentPickTeam}'s turn
          </div>
        </div>
      )}

      {lobby.status === 'BANNING' && lobby.banState && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(249,115,22,0.06)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 600, marginBottom: 4 }}>Ban Phase</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Ban #{lobby.banState.banNumber} - Team {lobby.banState.currentBanTeam}'s turn - {(lobby.banState.bans ?? []).length} ban(s) so far
          </div>
        </div>
      )}

      {lobby.status === 'MAP_VOTE' && lobby.mapVote && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(168,85,247,0.06)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.15)' }}>
          <div style={{ fontSize: 12, color: '#c084fc', fontWeight: 600, marginBottom: 4 }}>Map Vote</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {Object.keys(lobby.mapVote.votes ?? {}).length} vote(s) in - Candidates: {lobby.mapVote.candidates.map((id) => `#${id}`).join(', ')}
          </div>
        </div>
      )}

      {lobby.status === 'REPORTING' && lobby.pendingResult && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(100,116,139,0.06)', borderRadius: 8, border: '1px solid rgba(100,116,139,0.15)' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>Pending Result</div>
          <div style={{ fontSize: 12, color: '#e2e8f0' }}>
            {lobby.pendingResult.result === 'team1' ? 'Team 1 Won' : lobby.pendingResult.result === 'team2' ? 'Team 2 Won' : 'Draw'}
            {' '}<span style={{ color: '#64748b' }}>
              (reported by {lobby.players.find((p) => p.userId === lobby.pendingResult!.reportedBy)?.name ?? 'unknown'})
            </span>
          </div>
        </div>
      )}

      {/* Admin controls */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Actions:</span>

        {/* Result buttons for IN_PROGRESS, REPORTING, DISPUTED */}
        {['IN_PROGRESS', 'REPORTING', 'DISPUTED'].includes(lobby.status) && (
          <>
            <button className="ps-btn ps-btn-success" style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => onAction(lobby.id, '/resolve', { result: 'team1' })}
              disabled={acting === `${lobby.id}-/resolve`}
            >
              <Trophy size={11} /> T1 Won
            </button>
            <button className="ps-btn ps-btn-warning" style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => onAction(lobby.id, '/resolve', { result: 'team2' })}
              disabled={acting === `${lobby.id}-/resolve`}
            >
              <Trophy size={11} /> T2 Won
            </button>
            <button className="ps-btn ps-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => onAction(lobby.id, '/resolve', { result: 'draw' })}
              disabled={acting === `${lobby.id}-/resolve`}
            >
              Draw
            </button>
          </>
        )}

        {/* Force map for MAP_VOTE */}
        {lobby.status === 'MAP_VOTE' && lobby.mapVote?.candidates && (
          <select
            style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onAction(lobby.id, '/map-vote', { mapId: parseInt(e.target.value) })
            }}
          >
            <option value="">Force Map...</option>
            {lobby.mapVote.candidates.map((mapId) => (
              <option key={mapId} value={mapId}>Map #{mapId}</option>
            ))}
          </select>
        )}

        {/* Status override */}
        <select
          style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', marginLeft: 'auto' }}
          value=""
          onChange={async (e) => {
            if (e.target.value && await confirm({ message: `Force status to ${e.target.value}? This bypasses normal flow.`, variant: 'default' })) {
              adminAction('forceStatus', { status: e.target.value })
            }
          }}
        >
          <option value="">Force Status...</option>
          {ALL_STATUSES.filter((s) => s !== lobby.status).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        <button className="ps-btn ps-btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}
          onClick={async () => {
            if (await confirm({ message: 'Cancel this lobby?', variant: 'danger' })) onAction(lobby.id, '/resolve', { result: 'cancel' })
          }}
        >
          <XCircle size={11} /> Cancel
        </button>
      </div>
    </div>
  )
}

export function PugLobbiesDashboard() {
  const router = useRouter()
  const alert = useAlert()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [regionStatus, setRegionStatus] = useState<RegionStatus>({ na: false, emea: false, pacific: false })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<'all' | 'open' | 'invite'>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const fetchData = useCallback(async () => {
    try {
      const [openRes, inviteRes] = await Promise.all([
        fetch('/api/pug/lobby?tier=open'),
        fetch('/api/pug/lobby?tier=invite'),
      ])
      const openData = openRes.ok ? await openRes.json() : { lobbies: [] }
      const inviteData = inviteRes.ok ? await inviteRes.json() : { lobbies: [], regionQueueStatus: null }

      setLobbies([...openData.lobbies, ...inviteData.lobbies])
      if (inviteData.regionQueueStatus) {
        setRegionStatus(inviteData.regionQueueStatus)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  async function toggleRegion(region: string) {
    const isOpen = regionStatus[region]
    const action = isOpen ? 'close' : 'open'
    setToggling(region)
    try {
      const res = await fetch('/api/pug/queue-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, action }),
        credentials: 'include',
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setToggling(null)
    }
  }

  async function lobbyAction(lobbyId: number, path: string, body: Record<string, any>) {
    const key = `${lobbyId}-${path}`
    setActing(key)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        await alert({ message: data.error || 'Action failed', variant: 'danger' })
      }
      await fetchData()
    } finally {
      setActing(null)
    }
  }

  function toggleExpanded(lobbyId: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(lobbyId)) next.delete(lobbyId)
      else next.add(lobbyId)
      return next
    })
  }

  const filteredLobbies = lobbies
    .filter((l) => tierFilter === 'all' || l.tier === tierFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <div className="ps-header">
        <h1 className="ps-title">PUG Lobbies</h1>
      </div>

      {/* Region Queue Controls */}
      <div className="ps-section">
        <p className="ps-section-title">Invite Queue Controls</p>
        <div style={{ display: 'flex', gap: 12 }}>
          {REGIONS.map((r) => {
            const isOpen = regionStatus[r.value]
            const isToggling = toggling === r.value
            const regionLobbies = lobbies.filter(
              (l) => l.tier === 'invite' && l.region === r.value && l.status === 'OPEN',
            )
            const gracePeriodLobbies = regionLobbies.filter((l) => l.timeoutAt && !isOpen)
            const cardClass = isOpen
              ? 'ps-region-card ps-region-card-open'
              : gracePeriodLobbies.length > 0
                ? 'ps-region-card ps-region-card-closing'
                : 'ps-region-card'

            return (
              <div key={r.value} className={cardClass} style={{ flex: 1 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {isOpen ? (
                      <span style={{ color: '#4ade80' }}>Open - {regionLobbies.length} lobby(s)</span>
                    ) : gracePeriodLobbies.length > 0 ? (
                      <span style={{ color: '#facc15' }}>
                        Closing - {gracePeriodLobbies.length} lobby(s) -{' '}
                        <GraceCountdown timeoutAt={gracePeriodLobbies[0].timeoutAt!} />
                      </span>
                    ) : (
                      <span>Closed</span>
                    )}
                  </div>
                </div>
                <button
                  className={`ps-btn ${isOpen ? 'ps-btn-danger' : 'ps-btn-success'}`}
                  onClick={() => toggleRegion(r.value)}
                  disabled={isToggling}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {isToggling ? (
                    <Loader2 size={14} className="ps-spin" />
                  ) : isOpen ? (
                    <><PowerOff size={14} /> Close</>
                  ) : (
                    <><Power size={14} /> Open</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="ps-tabs">
        {(['all', 'open', 'invite'] as const).map((t) => (
          <button
            key={t}
            className={`ps-tab ${tierFilter === t ? 'ps-tab-active' : ''}`}
            onClick={() => setTierFilter(t)}
          >
            {t === 'all' ? 'All' : t === 'open' ? 'Open Tier' : 'Invite Tier'}
          </button>
        ))}
      </div>

      {/* Lobby Cards */}
      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading lobbies...</div>}

      {!loading && filteredLobbies.length === 0 && (
        <div className="ps-empty">
          <Gamepad2 size={40} strokeWidth={1.5} />
          <p>No active lobbies.</p>
        </div>
      )}

      {!loading && filteredLobbies.map((lobby) => {
        const statusClass = STATUS_CLASSES[lobby.status] ?? 'ps-badge-inactive'
        const hasGrace = !regionStatus[lobby.region ?? ''] && lobby.timeoutAt && lobby.status === 'OPEN'
        const isExpanded = expanded.has(lobby.id)

        return (
          <div key={lobby.id} style={{ marginBottom: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.15s' }}>
            {/* Card header */}
            <div
              style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', transition: 'background 0.15s' }}
              onClick={() => toggleExpanded(lobby.id)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div className={`ps-card-icon ps-card-icon-${lobby.tier}`}>
                <Gamepad2 size={20} />
              </div>
              <div className="ps-card-body">
                <p className="ps-card-name">PUG #{lobby.lobbyNumber}</p>
                <div className="ps-card-meta">
                  <span className={`ps-badge ps-badge-${lobby.tier}`}>{lobby.tier}</span>
                  {lobby.region && (
                    <span className={`ps-badge ps-badge-${lobby.region}`}>{lobby.region.toUpperCase()}</span>
                  )}
                  <span className={`ps-badge ${statusClass}`}>{lobby.status.replace('_', ' ')}</span>
                  <span className="ps-card-detail">
                    <Users size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {lobby.players.length}/10
                  </span>
                  <span className="ps-card-detail">
                    <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {timeAgo(lobby.createdAt)}
                  </span>
                  {hasGrace && lobby.timeoutAt && (
                    <span className="ps-card-detail" style={{ color: '#facc15' }}>
                      Grace: <GraceCountdown timeoutAt={lobby.timeoutAt} />
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="ps-btn ps-btn-ghost"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); window.open(`/pugs/lobby/${lobby.id}`, '_blank') }}
                >
                  <ExternalLink size={12} /> View
                </button>
                {isExpanded ? <ChevronUp size={16} style={{ color: '#64748b' }} /> : <ChevronDown size={16} style={{ color: '#334155' }} />}
              </div>
            </div>

            {/* Expanded panel */}
            {isExpanded && (
              <LobbyExpanded lobby={lobby} onAction={lobbyAction} acting={acting} />
            )}
          </div>
        )
      })}
    </div>
  )
}
