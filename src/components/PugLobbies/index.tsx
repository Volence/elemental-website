'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Gamepad2, Power, PowerOff, ExternalLink, XCircle, Loader2, Users, Clock } from 'lucide-react'
import { PUG_ADMIN_CSS, timeAgo } from '@/components/pugAdminStyles'

type Lobby = {
  id: number
  lobbyNumber: number
  tier: string
  region?: string | null
  status: string
  createdAt: string
  timeoutAt?: string | null
  players: Array<{ id: number; userId: number }>
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
}

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

export function PugLobbiesDashboard() {
  const router = useRouter()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [regionStatus, setRegionStatus] = useState<RegionStatus>({ na: false, emea: false, pacific: false })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [tierFilter, setTierFilter] = useState<'all' | 'open' | 'invite'>('all')

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

  async function cancelLobby(lobbyId: number) {
    if (!confirm('Cancel this lobby? Players will be removed.')) return
    setCancelling(lobbyId)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/clear`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setCancelling(null)
    }
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
        const isCancelling = cancelling === lobby.id

        return (
          <div key={lobby.id} className="ps-card" style={{ cursor: 'default' }}>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="ps-btn ps-btn-ghost"
                style={{ padding: '6px 10px', fontSize: 12 }}
                onClick={() => window.open(`/pugs/lobby/${lobby.id}`, '_blank')}
              >
                <ExternalLink size={12} /> View
              </button>
              {['OPEN', 'READY'].includes(lobby.status) && (
                <button
                  className="ps-btn ps-btn-danger"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => cancelLobby(lobby.id)}
                  disabled={isCancelling}
                >
                  {isCancelling ? <Loader2 size={12} className="ps-spin" /> : <><XCircle size={12} /> Cancel</>}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
