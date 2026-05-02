'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BarChart3, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react'
import { PUG_ADMIN_CSS } from '@/components/pugAdminStyles'

type LeaderboardEntry = {
  id: number
  player: { id: number; user?: { name?: string } | number } | number
  season: { id: number; name?: string } | number
  tier: string
  region?: string | null
  rating: number
  ratingDeviation: number
  volatility: number
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
}

function getPlayerName(entry: LeaderboardEntry): string {
  if (typeof entry.player === 'object') {
    const p = entry.player as any
    if (typeof p.user === 'object') return p.user.name ?? `Player #${p.id}`
    return `Player #${p.id}`
  }
  return `Player #${entry.player}`
}

function getSeasonName(entry: LeaderboardEntry): string {
  if (typeof entry.season === 'object') return (entry.season as any).name ?? `Season #${(entry.season as any).id}`
  return `Season #${entry.season}`
}

// ---- List View ----

export function PugLeaderboardListView() {
  const router = useRouter()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-leaderboard?limit=200&sort=-rating&depth=2')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Leaderboard</h1>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading leaderboard...</div>}

      {!loading && entries.length === 0 && (
        <div className="ps-empty">
          <BarChart3 size={40} strokeWidth={1.5} />
          <p>No leaderboard entries yet.</p>
        </div>
      )}

      {!loading && entries.map((e) => {
        const playerName = getPlayerName(e)
        const seasonName = getSeasonName(e)
        return (
          <div key={e.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-leaderboard?id=${e.id}`)}>
            <div className={`ps-card-icon ps-card-icon-${e.tier}`}>
              <BarChart3 size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">{playerName}</p>
              <div className="ps-card-meta">
                <span className={`ps-badge ps-badge-${e.tier}`}>{e.tier}</span>
                {e.region && <span className={`ps-badge ps-badge-${e.region}`}>{e.region.toUpperCase()}</span>}
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>
                  {e.rating}
                </span>
                <span className="ps-card-detail">
                  <span style={{ color: '#4ade80' }}>{e.wins}W</span>{' '}
                  <span style={{ color: '#f87171' }}>{e.losses}L</span>{' '}
                  <span style={{ color: '#64748b' }}>{e.draws}D</span>
                </span>
                <span className="ps-card-detail">{seasonName}</span>
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

export function PugLeaderboardEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    playerName: '',
    seasonName: '',
    tier: '',
    region: '',
    rating: 1500,
    ratingDeviation: 350,
    volatility: 0.06,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
  })

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-leaderboard/${id}?depth=2`)
      .then((r) => r.json())
      .then((data: LeaderboardEntry) => {
        setForm({
          playerName: getPlayerName(data),
          seasonName: getSeasonName(data),
          tier: data.tier,
          region: data.region ?? '',
          rating: data.rating,
          ratingDeviation: data.ratingDeviation,
          volatility: data.volatility,
          wins: data.wins,
          losses: data.losses,
          draws: data.draws,
          gamesPlayed: data.gamesPlayed,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function setField(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaveStatus('idle')
  }

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const res = await fetch(`/api/pug-leaderboard/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: form.rating,
          ratingDeviation: form.ratingDeviation,
          volatility: form.volatility,
          wins: form.wins,
          losses: form.losses,
          draws: form.draws,
          gamesPlayed: form.gamesPlayed,
        }),
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

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-leaderboard')}>
        <ArrowLeft size={14} /> Back to Leaderboard
      </button>

      <p className="ps-form-title">{form.playerName} - {form.seasonName}</p>

      {/* Player & Season (read-only) */}
      <div className="ps-section">
        <p className="ps-section-title">Player & Season</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Player</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.playerName}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Season</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.seasonName}</div>
          </div>
        </div>
        <div className="ps-row ps-row-2">
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Tier</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.tier}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Region</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.region ? form.region.toUpperCase() : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="ps-section">
        <p className="ps-section-title">Rating</p>
        <div className="ps-row ps-row-3">
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Rating</label>
            <input type="number" className="ps-input" value={form.rating} onChange={(e) => setField('rating', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Deviation</label>
            <input type="number" className="ps-input" value={form.ratingDeviation} onChange={(e) => setField('ratingDeviation', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Volatility</label>
            <input type="number" step="0.001" className="ps-input" value={form.volatility} onChange={(e) => setField('volatility', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Record */}
      <div className="ps-section">
        <p className="ps-section-title">Record</p>
        <div className="ps-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Wins</label>
            <input type="number" className="ps-input" value={form.wins} onChange={(e) => setField('wins', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Losses</label>
            <input type="number" className="ps-input" value={form.losses} onChange={(e) => setField('losses', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Draws</label>
            <input type="number" className="ps-input" value={form.draws} onChange={(e) => setField('draws', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Games Played</label>
            <input type="number" className="ps-input" value={form.gamesPlayed} onChange={(e) => setField('gamesPlayed', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Entry'}
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
