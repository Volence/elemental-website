'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Swords, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2, Calendar, AlertTriangle } from 'lucide-react'
import { PUG_ADMIN_CSS, formatDate } from '@/components/pugAdminStyles'

type TeamPlayer = {
  player: { id: number; user?: { name?: string } | number } | number
  assignedRole: string
  isCaptain: boolean
}

type HeroBan = {
  hero: { id: number; name?: string } | number
  team: number
  banOrder: number
}

type PugMatch = {
  id: number
  lobbyNumber: number
  tier: string
  result?: string | null
  date?: string | null
  season?: { id: number; name?: string } | number | null
  mapPlayed?: { id: number; name?: string } | number | null
  team1Players?: TeamPlayer[]
  team2Players?: TeamPlayer[]
  heroBans?: HeroBan[]
  reportedBy?: { id: number; name?: string } | number | null
  confirmedBy?: { id: number; name?: string } | number | null
  disputed: boolean
  disputeResolution?: { resolvedBy?: any; resolution?: string | null; notes?: string | null } | null
  prismaLobbyId?: number | null
  draftOrder?: any
}

const RESULT_LABELS: Record<string, { label: string; className: string }> = {
  team1: { label: 'Team 1 Win', className: 'ps-badge-active' },
  team2: { label: 'Team 2 Win', className: 'ps-badge-open' },
  draw: { label: 'Draw', className: 'ps-badge-inactive' },
  cancelled: { label: 'Cancelled', className: 'ps-badge-danger' },
}

const RESULT_OPTIONS = [
  { value: '', label: 'Pending' },
  { value: 'team1', label: 'Team 1 Win' },
  { value: 'team2', label: 'Team 2 Win' },
  { value: 'draw', label: 'Draw' },
  { value: 'cancelled', label: 'Cancelled' },
]

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank', 'flex-dps': 'Flex DPS', 'hitscan-dps': 'Hitscan DPS',
  'flex-support': 'Flex Support', 'main-support': 'Main Support',
}

function getObjName(obj: any, fallbackPrefix: string): string {
  if (!obj) return ''
  if (typeof obj === 'object') return obj.name ?? `${fallbackPrefix} #${obj.id}`
  return `${fallbackPrefix} #${obj}`
}

function getPlayerName(tp: TeamPlayer): string {
  if (typeof tp.player === 'object') {
    const p = tp.player as any
    if (typeof p.user === 'object') return p.user.name ?? `Player #${p.id}`
    return `Player #${p.id}`
  }
  return `Player #${tp.player}`
}

// ---- List View ----

export function PugMatchesListView() {
  const router = useRouter()
  const [matches, setMatches] = useState<PugMatch[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-matches?limit=100&sort=-date&depth=2')
      if (res.ok) {
        const data = await res.json()
        setMatches(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Matches</h1>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading matches...</div>}

      {!loading && matches.length === 0 && (
        <div className="ps-empty">
          <Swords size={40} strokeWidth={1.5} />
          <p>No completed matches yet.</p>
        </div>
      )}

      {!loading && matches.map((m) => {
        const resultInfo = m.result ? RESULT_LABELS[m.result] : null
        const mapName = getObjName(m.mapPlayed, 'Map')
        return (
          <div key={m.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-match?id=${m.id}`)}>
            <div className={`ps-card-icon ps-card-icon-${m.tier}`}>
              <Swords size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">PUG #{m.lobbyNumber}</p>
              <div className="ps-card-meta">
                <span className={`ps-badge ps-badge-${m.tier}`}>{m.tier}</span>
                {resultInfo && <span className={`ps-badge ${resultInfo.className}`}>{resultInfo.label}</span>}
                {!resultInfo && <span className="ps-badge ps-badge-warning">PENDING</span>}
                {m.disputed && <span className="ps-badge ps-badge-danger">DISPUTED</span>}
                {mapName && <span className="ps-card-detail">{mapName}</span>}
                {m.date && (
                  <span className="ps-card-detail">
                    <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {formatDate(m.date)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="ps-card-arrow" />
          </div>
        )
      })}
    </div>
  )
}

// ---- Edit View ----

export function PugMatchesEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [match, setMatch] = useState<PugMatch | null>(null)
  const [result, setResult] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-matches/${id}?depth=2`)
      .then((r) => r.json())
      .then((data: PugMatch) => {
        setMatch(data)
        setResult(data.result ?? '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const res = await fetch(`/api/pug-matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: result || null }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveStatus('error')
        setSaveMsg(data?.errors?.[0]?.message ?? data?.message ?? 'Save failed')
        return
      }
      setSaveStatus('saved')
      setSaveMsg('Saved')
    } catch (e: any) {
      setSaveStatus('error')
      setSaveMsg(e.message ?? 'Unexpected error')
    }
  }

  if (loading) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <p style={{ color: '#64748b' }}>Match not found.</p>
      </div>
    )
  }

  const seasonName = getObjName(match.season, 'Season')
  const mapName = getObjName(match.mapPlayed, 'Map')

  function renderTeam(players: TeamPlayer[] | undefined, label: string) {
    if (!players || players.length === 0) return <p style={{ color: '#475569', fontSize: 13 }}>No players</p>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.map((tp, i) => {
          const name = getPlayerName(tp)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
              <span style={{ fontWeight: tp.isCaptain ? 700 : 400 }}>
                {tp.isCaptain ? 'C ' : ''}{name}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{ROLE_LABELS[tp.assignedRole] ?? tp.assignedRole}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-matches')}>
        <ArrowLeft size={14} /> Back to Matches
      </button>

      <p className="ps-form-title">PUG #{match.lobbyNumber}</p>

      {/* Details */}
      <div className="ps-section">
        <p className="ps-section-title">Details</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Tier</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{match.tier}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Season</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{seasonName || 'N/A'}</div>
          </div>
        </div>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Date</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{formatDate(match.date) || 'N/A'}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Map</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{mapName || 'N/A'}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Result</label>
          <select
            className="ps-input ps-select"
            value={result}
            onChange={(e) => { setResult(e.target.value); setSaveStatus('idle') }}
          >
            {RESULT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Teams */}
      <div className="ps-section">
        <p className="ps-section-title">Teams</p>
        <div className="ps-row ps-row-2">
          <div>
            <label className="ps-label">Team 1</label>
            {renderTeam(match.team1Players, 'Team 1')}
          </div>
          <div>
            <label className="ps-label">Team 2</label>
            {renderTeam(match.team2Players, 'Team 2')}
          </div>
        </div>
      </div>

      {/* Hero Bans */}
      {match.heroBans && match.heroBans.length > 0 && (
        <div className="ps-section">
          <p className="ps-section-title">Hero Bans</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {match.heroBans.sort((a, b) => a.banOrder - b.banOrder).map((ban, i) => {
              const heroName = getObjName(ban.hero, 'Hero')
              return (
                <span key={i} className="ps-badge ps-badge-danger" style={{ fontSize: 12 }}>
                  T{ban.team} - {heroName}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Dispute */}
      {match.disputed && (
        <div className="ps-section" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <p className="ps-section-title">
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
            Dispute
          </p>
          <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
            {match.disputeResolution?.resolution || 'No resolution yet.'}
          </p>
          {match.disputeResolution?.notes && (
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{match.disputeResolution.notes}</p>
          )}
        </div>
      )}

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Match'}
        </button>
        {saveStatus === 'saved' && (
          <span className="ps-save-msg ps-save-ok"><Check size={14} /> {saveMsg}</span>
        )}
        {saveStatus === 'error' && (
          <span className="ps-save-msg ps-save-err"><AlertCircle size={14} /> {saveMsg}</span>
        )}
      </div>
    </div>
  )
}
