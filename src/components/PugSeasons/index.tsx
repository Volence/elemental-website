'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, ChevronRight, Check, AlertCircle, Loader2, ArrowLeft, Calendar, Trophy, Map } from 'lucide-react'
import { PUG_ADMIN_CSS, formatDate } from '@/components/pugAdminStyles'

// ── Types ──

type MapDoc = { id: number; name: string; type: string }

type MapPool = {
  control: number[]
  hybrid: number[]
  push: number[]
  escort: number[]
  flashpoint: number[]
}

type TimeWindow = {
  id?: string
  dayOfWeek: string
  startTime: string
  endTime: string
  timezone: string
}

type Season = {
  id: number
  name: string
  tier: 'open' | 'invite'
  active: boolean
  startDate?: string | null
  endDate?: string | null
  prizePool?: string | null
  mapPool?: {
    control?: Array<number | { id: number }> | null
    hybrid?: Array<number | { id: number }> | null
    push?: Array<number | { id: number }> | null
    escort?: Array<number | { id: number }> | null
    flashpoint?: Array<number | { id: number }> | null
  } | null
  timeWindows?: TimeWindow[] | null
  updatedAt?: string
}

const MAP_TYPES = [
  { key: 'control', label: 'Control' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'push', label: 'Push' },
  { key: 'escort', label: 'Escort' },
  { key: 'flashpoint', label: 'Flashpoint' },
] as const

const DAYS = [
  { value: '1', label: 'Monday' }, { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' }, { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' }, { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
]

function toId(v: number | { id: number }): number {
  return typeof v === 'object' ? v.id : v
}

function countMapPool(season: Season): number {
  const pool = season.mapPool
  if (!pool) return 0
  return (
    (pool.control?.length ?? 0) +
    (pool.hybrid?.length ?? 0) +
    (pool.push?.length ?? 0) +
    (pool.escort?.length ?? 0) +
    (pool.flashpoint?.length ?? 0)
  )
}


// ── List View ──

export function PugSeasonsListView() {
  const router = useRouter()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSeasons = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-seasons?limit=100&sort=-createdAt&depth=2')
      if (res.ok) {
        const data = await res.json()
        setSeasons(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSeasons() }, [fetchSeasons])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Seasons</h1>
        <button className="ps-btn ps-btn-primary" onClick={() => router.push('/admin/edit-pug-season')}>
          <Plus size={14} /> New Season
        </button>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading seasons…</div>}

      {!loading && seasons.length === 0 && (
        <div className="ps-empty">
          <Trophy size={40} strokeWidth={1.5} />
          <p>No seasons yet. Create one to get started.</p>
        </div>
      )}

      {!loading && seasons.map((s) => {
        const mapCount = countMapPool(s)
        const start = formatDate(s.startDate)
        const end = formatDate(s.endDate)
        return (
          <div key={s.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-season?id=${s.id}`)}>
            <div className={`ps-card-icon ps-card-icon-${s.tier}`}>
              <Trophy size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">{s.name}</p>
              <div className="ps-card-meta">
                <span className={`ps-badge ps-badge-${s.tier}`}>{s.tier}</span>
                <span className={`ps-badge ${s.active ? 'ps-badge-active' : 'ps-badge-inactive'}`}>
                  {s.active ? 'Active' : 'Inactive'}
                </span>
                {(start || end) && (
                  <span className="ps-card-detail">
                    <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {start ?? '?'} - {end ?? '?'}
                  </span>
                )}
                {mapCount > 0 && (
                  <span className="ps-card-detail">
                    <Map size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {mapCount} map{mapCount !== 1 ? 's' : ''} in pool
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

// ── Edit View ──

export function PugSeasonsEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const isNew = !id

  const [allMaps, setAllMaps] = useState<MapDoc[]>([])
  const [form, setForm] = useState({
    name: '',
    tier: 'open' as 'open' | 'invite',
    active: false,
    startDate: '',
    endDate: '',
    prizePool: '',
    mapPool: { control: [] as number[], hybrid: [] as number[], push: [] as number[], escort: [] as number[], flashpoint: [] as number[] },
    timeWindows: [] as TimeWindow[],
  })
  const [loading, setLoading] = useState(!isNew)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')

  // Fetch all maps
  useEffect(() => {
    fetch('/api/maps?limit=200&depth=0&sort=name')
      .then(r => r.json())
      .then(data => setAllMaps(data.docs ?? []))
  }, [])

  // Fetch season if editing
  useEffect(() => {
    if (!id) return
    fetch(`/api/pug-seasons/${id}?depth=2`)
      .then(r => r.json())
      .then((data: Season) => {
        const pool = data.mapPool ?? {}
        setForm({
          name: data.name ?? '',
          tier: data.tier ?? 'open',
          active: data.active ?? false,
          startDate: data.startDate ? data.startDate.split('T')[0] : '',
          endDate: data.endDate ? data.endDate.split('T')[0] : '',
          prizePool: data.prizePool ?? '',
          mapPool: {
            control: (pool.control ?? []).map(toId),
            hybrid: (pool.hybrid ?? []).map(toId),
            push: (pool.push ?? []).map(toId),
            escort: (pool.escort ?? []).map(toId),
            flashpoint: (pool.flashpoint ?? []).map(toId),
          },
          timeWindows: (data.timeWindows ?? []).map(tw => ({ ...tw })),
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function setField(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
    setSaveStatus('idle')
  }

  function toggleMap(type: keyof MapPool, mapId: number) {
    setForm(f => {
      const current = f.mapPool[type]
      const next = current.includes(mapId) ? current.filter(i => i !== mapId) : [...current, mapId]
      return { ...f, mapPool: { ...f.mapPool, [type]: next } }
    })
    setSaveStatus('idle')
  }

  function addTimeWindow() {
    setForm(f => ({
      ...f,
      timeWindows: [...f.timeWindows, { dayOfWeek: '5', startTime: '19:00', endTime: '22:00', timezone: 'America/New_York' }],
    }))
  }

  function removeTimeWindow(i: number) {
    setForm(f => ({ ...f, timeWindows: f.timeWindows.filter((_, idx) => idx !== i) }))
  }

  function setTimeWindow(i: number, key: keyof TimeWindow, value: string) {
    setForm(f => {
      const tws = [...f.timeWindows]
      tws[i] = { ...tws[i], [key]: value }
      return { ...f, timeWindows: tws }
    })
  }

  async function save() {
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const body: any = {
        name: form.name,
        tier: form.tier,
        active: form.active,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        prizePool: form.prizePool || null,
        mapPool: form.mapPool,
        timeWindows: form.timeWindows,
      }
      const url = isNew ? '/api/pug-seasons' : `/api/pug-seasons/${id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
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
      if (isNew && data.doc?.id) {
        router.replace(`/admin/edit-pug-season?id=${data.doc.id}`)
      }
    } catch (e: any) {
      setSaveStatus('error')
      setSaveMsg(e.message ?? 'Unexpected error')
    }
  }

  if (loading) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  const mapsByType = MAP_TYPES.reduce<Record<string, MapDoc[]>>((acc, t) => {
    acc[t.key] = allMaps.filter(m => m.type === t.key).sort((a, b) => a.name.localeCompare(b.name))
    return acc
  }, {})

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-seasons')}>
        <ArrowLeft size={14} /> Back to Seasons
      </button>

      <p className="ps-form-title">{isNew ? 'New Season' : form.name || 'Edit Season'}</p>

      {/* Basic Info */}
      <div className="ps-section">
        <p className="ps-section-title">Details</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Name</label>
            <input className="ps-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Season 1" />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Tier</label>
            <select className="ps-input ps-select" value={form.tier} onChange={e => setField('tier', e.target.value as 'open' | 'invite')}>
              <option value="open">Open</option>
              <option value="invite">Invite</option>
            </select>
          </div>
        </div>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Start Date</label>
            <input type="date" className="ps-input" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">End Date</label>
            <input type="date" className="ps-input" value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
          </div>
        </div>
        <div className="ps-check-row" style={{ marginBottom: form.tier === 'invite' ? 16 : 0 }}>
          <input type="checkbox" id="ps-active" checked={form.active} onChange={e => setField('active', e.target.checked)} />
          <label htmlFor="ps-active" className="ps-check-label">Active season</label>
        </div>
        {form.tier === 'invite' && (
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Prize Pool</label>
            <input className="ps-input" value={form.prizePool} onChange={e => setField('prizePool', e.target.value)} placeholder='e.g. "$100 gift card for 1st place"' />
          </div>
        )}
      </div>

      {/* Map Pool */}
      <div className="ps-section">
        <p className="ps-section-title">Map Pool</p>
        <div className="ps-map-grid">
          {(['control', 'hybrid'] as const).map(type => {
            const maps = mapsByType[type] ?? []
            return (
              <div key={type} className="ps-map-type">
                <p className="ps-map-type-title">{MAP_TYPES.find(t => t.key === type)?.label}</p>
                {maps.length === 0
                  ? <p className="ps-map-empty">No maps of this type</p>
                  : maps.map(m => (
                    <div key={m.id} className="ps-map-item">
                      <input
                        type="checkbox"
                        id={`map-${type}-${m.id}`}
                        checked={form.mapPool[type].includes(m.id)}
                        onChange={() => toggleMap(type, m.id)}
                      />
                      <label htmlFor={`map-${type}-${m.id}`}>{m.name}</label>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </div>
        <div className="ps-map-grid-3">
          {(['push', 'escort', 'flashpoint'] as const).map(type => {
            const maps = mapsByType[type] ?? []
            return (
              <div key={type} className="ps-map-type">
                <p className="ps-map-type-title">{MAP_TYPES.find(t => t.key === type)?.label}</p>
                {maps.length === 0
                  ? <p className="ps-map-empty">No maps of this type</p>
                  : maps.map(m => (
                    <div key={m.id} className="ps-map-item">
                      <input
                        type="checkbox"
                        id={`map-${type}-${m.id}`}
                        checked={form.mapPool[type].includes(m.id)}
                        onChange={() => toggleMap(type, m.id)}
                      />
                      <label htmlFor={`map-${type}-${m.id}`}>{m.name}</label>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Time Windows (invite only) */}
      {form.tier === 'invite' && (
        <div className="ps-section">
          <p className="ps-section-title">Queue Time Windows</p>
          {form.timeWindows.map((tw, i) => (
            <div key={i} className="ps-tw">
              <div className="ps-tw-header">
                <span className="ps-tw-title">Window {i + 1}</span>
                <button className="ps-btn ps-btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => removeTimeWindow(i)}>Remove</button>
              </div>
              <div className="ps-row ps-row-2" style={{ marginBottom: 10 }}>
                <div>
                  <label className="ps-label">Day</label>
                  <select className="ps-input ps-select" value={tw.dayOfWeek} onChange={e => setTimeWindow(i, 'dayOfWeek', e.target.value)}>
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ps-label">Timezone</label>
                  <input className="ps-input" value={tw.timezone} onChange={e => setTimeWindow(i, 'timezone', e.target.value)} />
                </div>
              </div>
              <div className="ps-row ps-row-2">
                <div>
                  <label className="ps-label">Start (HH:MM)</label>
                  <input className="ps-input" value={tw.startTime} onChange={e => setTimeWindow(i, 'startTime', e.target.value)} placeholder="19:00" />
                </div>
                <div>
                  <label className="ps-label">End (HH:MM)</label>
                  <input className="ps-input" value={tw.endTime} onChange={e => setTimeWindow(i, 'endTime', e.target.value)} placeholder="22:00" />
                </div>
              </div>
            </div>
          ))}
          <button className="ps-btn ps-btn-ghost" onClick={addTimeWindow}>
            <Plus size={13} /> Add Window
          </button>
        </div>
      )}

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving' || !form.name}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving…</> : 'Save Season'}
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
