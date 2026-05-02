'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { User, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2, ShieldAlert, Calendar } from 'lucide-react'
import { PUG_ADMIN_CSS, formatDate } from '@/components/pugAdminStyles'

type PugPlayer = {
  id: number
  user: { id: number; name?: string; email?: string } | number
  tiers: string[]
  approvedRoles?: string[]
  inviteRegions?: string[]
  registeredDate?: string | null
  invitedBy?: { id: number; name?: string } | number | null
  activeBan?: { bannedUntil?: string | null; reason?: string | null }
  banOffenseCount?: number
}

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank', 'flex-dps': 'Flex DPS', 'hitscan-dps': 'Hitscan DPS',
  'flex-support': 'Flex Support', 'main-support': 'Main Support',
}

const ROLE_OPTIONS = [
  { value: 'tank', label: 'Tank' },
  { value: 'flex-dps', label: 'Flex DPS' },
  { value: 'hitscan-dps', label: 'Hitscan DPS' },
  { value: 'flex-support', label: 'Flex Support' },
  { value: 'main-support', label: 'Main Support' },
]

const REGION_OPTIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
]

const TIER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'invite', label: 'Invite' },
]

function isBanned(ban?: PugPlayer['activeBan']): boolean {
  if (!ban?.bannedUntil) return false
  return new Date(ban.bannedUntil) > new Date()
}

function getUserName(user: PugPlayer['user']): string {
  if (typeof user === 'object') return user.name ?? user.email ?? `User #${user.id}`
  return `User #${user}`
}

// ---- List View ----

export function PugPlayersListView() {
  const router = useRouter()
  const [players, setPlayers] = useState<PugPlayer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-players?limit=200&sort=-createdAt&depth=1')
      if (res.ok) {
        const data = await res.json()
        setPlayers(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Players</h1>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading players...</div>}

      {!loading && players.length === 0 && (
        <div className="ps-empty">
          <User size={40} strokeWidth={1.5} />
          <p>No registered PUG players yet.</p>
        </div>
      )}

      {!loading && players.map((p) => {
        const name = getUserName(p.user)
        const banned = isBanned(p.activeBan)
        return (
          <div key={p.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-player?id=${p.id}`)}>
            <div className="ps-card-icon ps-card-icon-default">
              <User size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">{name}</p>
              <div className="ps-card-meta">
                {p.tiers?.map((t) => (
                  <span key={t} className={`ps-badge ps-badge-${t}`}>{t}</span>
                ))}
                {p.inviteRegions?.map((r) => (
                  <span key={r} className={`ps-badge ps-badge-${r}`}>{r.toUpperCase()}</span>
                ))}
                {banned && <span className="ps-badge ps-badge-danger">BANNED</span>}
                {p.approvedRoles && p.approvedRoles.length > 0 && (
                  <span className="ps-card-detail">
                    {p.approvedRoles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
                  </span>
                )}
                {p.registeredDate && (
                  <span className="ps-card-detail">
                    <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {formatDate(p.registeredDate)}
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

export function PugPlayersEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    userName: '',
    userId: null as number | null,
    tiers: [] as string[],
    approvedRoles: [] as string[],
    inviteRegions: [] as string[],
    registeredDate: '',
    invitedByName: '',
    bannedUntil: '',
    banReason: '',
    banOffenseCount: 0,
  })

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-players/${id}?depth=1`)
      .then((r) => r.json())
      .then((data: PugPlayer) => {
        const userName = getUserName(data.user)
        const userId = typeof data.user === 'object' ? data.user.id : data.user
        const invitedByName = typeof data.invitedBy === 'object' && data.invitedBy
          ? (data.invitedBy.name ?? `User #${data.invitedBy.id}`)
          : ''
        setForm({
          userName,
          userId,
          tiers: data.tiers ?? [],
          approvedRoles: data.approvedRoles ?? [],
          inviteRegions: data.inviteRegions ?? [],
          registeredDate: data.registeredDate ? data.registeredDate.split('T')[0] : '',
          invitedByName,
          bannedUntil: data.activeBan?.bannedUntil ? data.activeBan.bannedUntil.split('T')[0] : '',
          banReason: data.activeBan?.reason ?? '',
          banOffenseCount: data.banOffenseCount ?? 0,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function toggleArrayItem(key: 'tiers' | 'approvedRoles' | 'inviteRegions', value: string) {
    setForm((f) => {
      const arr = f[key]
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...f, [key]: next }
    })
    setSaveStatus('idle')
  }

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const body: any = {
        tiers: form.tiers,
        approvedRoles: form.approvedRoles,
        inviteRegions: form.inviteRegions,
        activeBan: {
          bannedUntil: form.bannedUntil || null,
          reason: form.banReason || null,
        },
      }
      const res = await fetch(`/api/pug-players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const hasInvite = form.tiers.includes('invite')

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-players')}>
        <ArrowLeft size={14} /> Back to Players
      </button>

      <p className="ps-form-title">{form.userName || 'PUG Player'}</p>

      {/* Details */}
      <div className="ps-section">
        <p className="ps-section-title">Details</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">User</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.userName}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Registered</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.registeredDate || 'N/A'}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Tiers</label>
          <div className="ps-pills">
            {TIER_OPTIONS.map((t) => (
              <span
                key={t.value}
                className={`ps-pill ${form.tiers.includes(t.value) ? 'ps-pill-active' : ''}`}
                onClick={() => toggleArrayItem('tiers', t.value)}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Settings */}
      {hasInvite && (
        <div className="ps-section">
          <p className="ps-section-title">Invite Settings</p>
          <div className="ps-field">
            <label className="ps-label">Regions</label>
            <div className="ps-pills">
              {REGION_OPTIONS.map((r) => (
                <span
                  key={r.value}
                  className={`ps-pill ${form.inviteRegions.includes(r.value) ? 'ps-pill-active' : ''}`}
                  onClick={() => toggleArrayItem('inviteRegions', r.value)}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          <div className="ps-field">
            <label className="ps-label">Approved Roles</label>
            <div className="ps-pills">
              {ROLE_OPTIONS.map((r) => (
                <span
                  key={r.value}
                  className={`ps-pill ${form.approvedRoles.includes(r.value) ? 'ps-pill-active' : ''}`}
                  onClick={() => toggleArrayItem('approvedRoles', r.value)}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          {form.invitedByName && (
            <div className="ps-field">
              <label className="ps-label">Invited By</label>
              <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.invitedByName}</div>
            </div>
          )}
        </div>
      )}

      {/* Ban Status */}
      <div className="ps-section">
        <p className="ps-section-title">
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
          Ban Status
        </p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Banned Until</label>
            <input
              type="date"
              className="ps-input"
              value={form.bannedUntil}
              onChange={(e) => { setForm((f) => ({ ...f, bannedUntil: e.target.value })); setSaveStatus('idle') }}
            />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Offense Count</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.banOffenseCount}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Reason</label>
          <input
            className="ps-input"
            value={form.banReason}
            onChange={(e) => { setForm((f) => ({ ...f, banReason: e.target.value })); setSaveStatus('idle') }}
            placeholder="Ban reason"
          />
        </div>
      </div>

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Player'}
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
