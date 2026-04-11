'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Save, Check, AlertCircle, Loader2, ArrowLeft, Plus, Trash2,
  Shield, Users, Gamepad2, Trophy, Palette, Calendar,
  Globe, Star, Eye, ExternalLink, Hash, MessageSquare, Clock,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'

// ── Types ──

type Person = { id: number; name: string }
type Team = {
  id: number
  name: string
  slug: string
  region: string
  rating: string
  bio: string
  active: boolean
  brandingPrimary: string
  brandingSecondary: string
  competitiveRating: number | null
  logo: any
  logoFilename: string
  manager: Array<{ person: Person | number; id?: string }>
  coaches: Array<{ person: Person | number; id?: string }>
  captain: Array<{ person: Person | number; id?: string }>
  coCaptain: Person | number | null
  roster: Array<{ person: Person | number; role: string; id?: string }>
  subs: Array<{ person: Person | number; id?: string }>
  achievements: Array<{ achievement: string; id?: string }>
  faceitEnabled: boolean
  faceitTeamId: string
  currentFaceitLeague: any
  faceitShowCompetitiveSection: boolean
  rolePreset: string
  customRoles: string
  scheduleTimezone: string
  scheduleBlocks: Array<{ label: string; startTime: string; endTime: string; id?: string }>
  discordThreads: {
    availabilityThreadId?: string
    calendarThreadId?: string
    scheduleThreadId?: string
    scrimCodesThreadId?: string
  }
  activeTournaments: any[]
  discordCardMessageId: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const REGIONS = [
  { value: 'NA', label: 'North America' },
  { value: 'EMEA', label: 'EMEA' },
  { value: 'SA', label: 'South America' },
  { value: 'OCE', label: 'Oceania' },
  { value: 'SEA', label: 'Southeast Asia' },
  { value: 'APAC', label: 'Asia-Pacific' },
  { value: 'China', label: 'China' },
  { value: 'Other', label: 'Other' },
]

const ROLES = [
  { value: 'tank', label: 'Tank' },
  { value: 'dps', label: 'DPS' },
  { value: 'support', label: 'Support' },
]

const TIMEZONES = [
  { value: 'America/New_York', label: 'EST' },
  { value: 'America/Chicago', label: 'CST' },
  { value: 'America/Denver', label: 'MST' },
  { value: 'America/Los_Angeles', label: 'PST' },
  { value: 'Europe/London', label: 'GMT' },
  { value: 'Europe/Berlin', label: 'CET' },
  { value: 'Europe/Helsinki', label: 'EET' },
  { value: 'Asia/Tokyo', label: 'JST' },
  { value: 'Australia/Sydney', label: 'AEST' },
  { value: 'Pacific/Auckland', label: 'NZST' },
]

const getPersonName = (p: Person | number | null | undefined): string => {
  if (!p) return ''
  if (typeof p === 'object') return p.name ?? ''
  return `Person #${p}`
}

const getPersonId = (p: Person | number | null | undefined): number | null => {
  if (!p) return null
  if (typeof p === 'object') return p.id
  return p
}

// ── Create Person Modal ──

function CreatePersonModal({ onCreated, onClose }: { onCreated: (id: number, name: string) => void; onClose: () => void }) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to create')
      }
      const doc = await res.json()
      const id = doc.doc?.id ?? doc.id
      onCreated(id, newName.trim())
    } catch (err: any) {
      setError(err.message)
      setCreating(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>Create New Person</h3>
        <input
          className="profile-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Enter name..."
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '6px 0 16px' }}>Creates a minimal person record. You can add more details later.</p>
        {error && <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button className="profile-save-btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Creating...' : 'Create & Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Person Search Component ──

function PersonSearch({ value, onChange, placeholder, onRequestCreate }: { value: number | null; onChange: (id: number | null, name: string) => void; placeholder?: string; onRequestCreate?: () => void }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [displayName, setDisplayName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (value && !displayName) {
      fetch(`/api/people/${value}?depth=0`).then(r => r.json()).then(d => setDisplayName(d.name ?? '')).catch(() => {})
    }
  }, [value, displayName])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    try {
      const res = await fetch(`/api/people?where[name][contains]=${encodeURIComponent(q)}&limit=10&depth=0`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.docs ?? [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  // When a value is set, show just the name (no ✕ — parent handles removal)
  if (value && displayName) {
    return <span style={{ fontSize: 13, color: '#e2e8f0' }}>{displayName}</span>
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="profile-input"
        style={{ fontSize: 13, padding: '6px 10px' }}
        value={search}
        onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder ?? 'Search people...'}
      />
      {showDropdown && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, maxHeight: 220, overflowY: 'auto', zIndex: 50 }}>
          {results.map(p => (
            <div
              key={p.id}
              style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
              onMouseDown={e => { e.preventDefault(); onChange(p.id, p.name); setDisplayName(p.name); setSearch(''); setShowDropdown(false) }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {p.name}
            </div>
          ))}
          {onRequestCreate && (
            <div
              style={{ padding: '8px 12px', fontSize: 13, color: '#34d399', cursor: 'pointer', borderTop: results.length ? '1px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseDown={e => { e.preventDefault(); onRequestCreate(); setShowDropdown(false); setSearch('') }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={13} /> Create new person{search ? `: "${search}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Team Editor ──

export default function TeamEditor() {
  const searchParams = useSearchParams()
  const teamId = searchParams.get('id')
  const isNew = !teamId

  const [loading, setLoading] = useState(!isNew)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalCallback, setCreateModalCallback] = useState<((id: number, name: string) => void) | null>(null)

  const openCreateModal = (callback: (id: number, name: string) => void) => {
    setCreateModalCallback(() => callback)
    setShowCreateModal(true)
  }

  // Basic Info
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [region, setRegion] = useState('')
  const [rating, setRating] = useState('')
  const [bio, setBio] = useState('')
  const [active, setActive] = useState(true)
  const [competitiveRating, setCompetitiveRating] = useState('')

  // Branding
  const [brandingPrimary, setBrandingPrimary] = useState('#34d399')
  const [brandingSecondary, setBrandingSecondary] = useState('#06b6d4')

  // Staff
  const [managers, setManagers] = useState<Array<{ personId: number | null; personName: string }>>([])
  const [coaches, setCoaches] = useState<Array<{ personId: number | null; personName: string }>>([])
  const [captains, setCaptains] = useState<Array<{ personId: number | null; personName: string }>>([])

  // Roster
  const [roster, setRoster] = useState<Array<{ personId: number | null; personName: string; role: string }>>([])
  const [subs, setSubs] = useState<Array<{ personId: number | null; personName: string }>>([])

  // Achievements
  const [achievements, setAchievements] = useState<Array<{ achievement: string }>>([])

  // FaceIt
  const [faceitEnabled, setFaceitEnabled] = useState(false)
  const [faceitTeamId, setFaceitTeamId] = useState('')
  const [faceitShowCompetitive, setFaceitShowCompetitive] = useState(true)

  // Scheduling
  const [rolePreset, setRolePreset] = useState('specific')
  const [customRoles, setCustomRoles] = useState('')
  const [scheduleTimezone, setScheduleTimezone] = useState('')
  const [scheduleBlocks, setScheduleBlocks] = useState<Array<{ label: string; startTime: string; endTime: string }>>([])
  const [discordThreads, setDiscordThreads] = useState<Record<string, string>>({})

  // Logo
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFilename, setLogoFilename] = useState('')

  const fetchTeam = useCallback(async () => {
    if (!teamId) return
    try {
      const res = await fetch(`/api/teams/${teamId}?depth=1`)
      if (!res.ok) throw new Error('Failed to load team')
      const t: Team = await res.json()

      setName(t.name ?? '')
      setSlug(t.slug ?? '')
      setRegion(t.region ?? '')
      setRating(t.rating ?? '')
      setBio(t.bio ?? '')
      setActive(t.active ?? true)
      setCompetitiveRating(t.competitiveRating?.toString() ?? '')
      setBrandingPrimary(t.brandingPrimary ?? '#34d399')
      setBrandingSecondary(t.brandingSecondary ?? '#06b6d4')

      // Logo
      if (t.logo && typeof t.logo === 'object') {
        setLogoUrl(t.logo.url ?? '')
        setLogoFilename(t.logo.filename ?? t.logoFilename ?? '')
      } else {
        setLogoFilename(t.logoFilename ?? '')
      }

      // Staff
      setManagers((t.manager ?? []).map(m => ({ personId: getPersonId(m.person), personName: getPersonName(m.person) })))
      setCoaches((t.coaches ?? []).map(c => ({ personId: getPersonId(c.person), personName: getPersonName(c.person) })))
      setCaptains((t.captain ?? []).map(c => ({ personId: getPersonId(c.person), personName: getPersonName(c.person) })))

      // Roster
      setRoster((t.roster ?? []).map(r => ({ personId: getPersonId(r.person), personName: getPersonName(r.person), role: r.role ?? 'dps' })))
      setSubs((t.subs ?? []).map(s => ({ personId: getPersonId(s.person), personName: getPersonName(s.person) })))

      // Achievements
      setAchievements((t.achievements ?? []).map(a => ({ achievement: a.achievement ?? '' })))

      // FaceIt
      setFaceitEnabled(t.faceitEnabled ?? false)
      setFaceitTeamId(t.faceitTeamId ?? '')
      setFaceitShowCompetitive(t.faceitShowCompetitiveSection ?? true)

      // Scheduling
      setRolePreset(t.rolePreset ?? 'specific')
      setCustomRoles(t.customRoles ?? '')
      setScheduleTimezone(t.scheduleTimezone ?? '')
      setScheduleBlocks((t.scheduleBlocks ?? []).map(b => ({ label: b.label, startTime: b.startTime, endTime: b.endTime })))
      setDiscordThreads(t.discordThreads ?? {})
    } catch (err) {
      console.error('Team load error:', err)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  const handleSave = async () => {
    setSaveStatus('saving')
    setErrorMsg('')
    try {
      const payload: Record<string, any> = {
        name, slug, region, rating, bio, active,
        competitiveRating: competitiveRating ? Number(competitiveRating) : null,
        brandingPrimary, brandingSecondary,
        manager: managers.filter(m => m.personId).map(m => ({ person: m.personId })),
        coaches: coaches.filter(c => c.personId).map(c => ({ person: c.personId })),
        captain: captains.filter(c => c.personId).map(c => ({ person: c.personId })),
        roster: roster.filter(r => r.personId).map(r => ({ person: r.personId, role: r.role })),
        subs: subs.filter(s => s.personId).map(s => ({ person: s.personId })),
        achievements: achievements.filter(a => a.achievement.trim()).map(a => ({ achievement: a.achievement })),
        faceitEnabled, faceitTeamId, faceitShowCompetitiveSection: faceitShowCompetitive,
        rolePreset, customRoles, scheduleTimezone,
        scheduleBlocks: scheduleBlocks.filter(b => b.label.trim()),
        discordThreads,
      }

      const url = teamId ? `/api/teams/${teamId}` : '/api/teams'
      const method = teamId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }

      setSaveStatus('saved')
      if (isNew) {
        const doc = await res.json()
        const newId = doc.doc?.id ?? doc.id
        setTimeout(() => { window.location.href = `/admin/edit-team?id=${newId}` }, 500)
      } else {
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!teamId || !confirm('Delete this team? This cannot be undone.')) return
    try {
      await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
      window.location.href = '/admin/collections/teams'
    } catch {}
  }

  // Array helpers
  const addManager = () => setManagers(p => [...p, { personId: null, personName: '' }])
  const addCoach = () => setCoaches(p => [...p, { personId: null, personName: '' }])
  const addCaptain = () => setCaptains(p => [...p, { personId: null, personName: '' }])
  const addRoster = () => setRoster(p => [...p, { personId: null, personName: '', role: 'dps' }])
  const addSub = () => setSubs(p => [...p, { personId: null, personName: '' }])
  const addAchievement = () => setAchievements(p => [...p, { achievement: '' }])
  const addBlock = () => setScheduleBlocks(p => [...p, { label: '', startTime: '', endTime: '' }])

  // Reorder helper — swap item at index with adjacent
  const move = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, from: number, to: number) => {
    setter(prev => {
      if (to < 0 || to >= prev.length) return prev
      const arr = [...prev]
      ;[arr[from], arr[to]] = [arr[to], arr[from]]
      return arr
    })
  }

  if (loading) {
    return (
      <div style={editorStyles.container}>
        <style>{EDITOR_CSS}</style>
        <div style={editorStyles.emptyState}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /></div>
      </div>
    )
  }

  return (
    <div style={editorStyles.container}>
      {/* Create person modal */}
      {showCreateModal && (
        <CreatePersonModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id, name) => { createModalCallback?.(id, name); setShowCreateModal(false) }}
        />
      )}

      <style>{EDITOR_CSS + `
        .toggle-switch { position: relative; width: 36px !important; height: 20px !important; min-height: 20px !important; max-height: 20px !important; border-radius: 10px; cursor: pointer; transition: background 0.2s; border: none; padding: 0; display: block; line-height: 0; font-size: 0; flex-shrink: 0; box-sizing: border-box; overflow: hidden; }
        .toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 0.2s; display: block; box-sizing: border-box; }
        .toggle-switch.on { background: #34d399; }
        .toggle-switch.on::after { transform: translateX(16px); }
        .toggle-switch.off { background: rgba(255,255,255,0.15); }
        .color-swatch { width: 36px; height: 36px; border-radius: 8px; cursor: pointer; position: relative; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .color-swatch input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .person-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .person-row:last-child { border-bottom: none; }
        .role-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e2e8f0; padding: 4px 8px; font-size: 12px; }
        .role-select option { background: #1a1f2e; color: #e2e8f0; }
        .profile-input option { background: #1a1f2e; color: #e2e8f0; }
        select.profile-input { color: #e2e8f0; }
        select.profile-input option { background: #1a1f2e; color: #e2e8f0; padding: 8px; }
        .thread-field { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .block-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr auto; gap: 8px; align-items: center; padding: 4px 0; }
        .reorder-btns { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
        .reorder-btn { background: none; border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.35); cursor: pointer; padding: 1px 3px; border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; line-height: 0; }
        .reorder-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }
        .reorder-btn:disabled { opacity: 0.2; cursor: default; }
      `}</style>

      <a href="/admin/collections/teams" className="back-link"><ArrowLeft size={14} /> Back to Teams</a>

      {/* Header */}
      <div style={editorStyles.header}>
        <div style={editorStyles.headerLeft}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: `linear-gradient(135deg, ${brandingPrimary}20, ${brandingSecondary}20)`, border: `2px solid ${brandingPrimary}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
            ) : (
              <Shield size={24} style={{ color: brandingPrimary, opacity: 0.5 }} />
            )}
          </div>
          <div>
            <input
              className="profile-input"
              style={editorStyles.nameInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Team name..."
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {region && <span className="team-tag" style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}><Globe size={11} /> {REGIONS.find(r => r.value === region)?.label ?? region}</span>}
              {rating && <span className="team-tag" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}><Star size={11} /> {rating}</span>}
              <span className="team-tag" style={active ? {} : { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                {active ? '● Active' : '○ Inactive'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {teamId && <button className="remove-btn" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={handleDelete}><Trash2 size={14} /></button>}
          <button className="profile-save-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : saveStatus === 'saved' ? <><Check size={16} /> Saved!</>
              : saveStatus === 'error' ? <><AlertCircle size={16} /> Error</>
              : <><Save size={16} /> {isNew ? 'Create Team' : 'Save Changes'}</>}
          </button>
        </div>
      </div>
      {saveStatus === 'error' && errorMsg && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{errorMsg}</p>}

      <div style={editorStyles.grid}>
        {/* ── Left Column ── */}
        <div style={editorStyles.leftColumn}>
          {/* Basic Info */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Shield size={16} /> Basic Info</h3>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Region</label>
              <select className="profile-input" value={region} onChange={e => setRegion(e.target.value)} style={{ fontSize: 13 }}>
                <option value="">Select region...</option>
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Rating</label>
              <input className="profile-input" value={rating} onChange={e => setRating(e.target.value)} placeholder='e.g., "FACEIT Masters", "4.5K"' />
            </div>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Slug</label>
              <input className="profile-input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto-generated" />
            </div>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Bio</label>
              <textarea className="profile-input profile-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="Team description..." style={{ minHeight: 80 }} />
            </div>
            <div style={{ ...editorStyles.readonlyField, justifyContent: 'space-between' }}>
              <span style={editorStyles.fieldLabel}>Active</span>
              <button className={`toggle-switch ${active ? 'on' : 'off'}`} onClick={() => setActive(!active)} type="button" />
            </div>
          </div>

          {/* Staff */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Users size={16} /> Staff</h3>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Managers</p>
            {managers.map((m, i) => (
              <div className="person-row" key={i}>
                <div style={{ flex: 1 }}>
                  <PersonSearch value={m.personId} onChange={(id, n) => setManagers(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x))} onRequestCreate={() => openCreateModal((id, n) => setManagers(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x)))} />
                </div>
                <div className="reorder-btns">
                  <button className="reorder-btn" onClick={() => move(setManagers, i, i - 1)} disabled={i === 0} title="Move up"><ChevronUp size={12} /></button>
                  <button className="reorder-btn" onClick={() => move(setManagers, i, i + 1)} disabled={i === managers.length - 1} title="Move down"><ChevronDown size={12} /></button>
                </div>
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setManagers(p => p.filter((_, j) => j !== i))} title="Remove"><Trash2 size={12} /></button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addManager}>+ Add Manager</button>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '16px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coaches</p>
            {coaches.map((c, i) => (
              <div className="person-row" key={i}>
                <div style={{ flex: 1 }}>
                  <PersonSearch value={c.personId} onChange={(id, n) => setCoaches(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x))} onRequestCreate={() => openCreateModal((id, n) => setCoaches(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x)))} />
                </div>
                <div className="reorder-btns">
                  <button className="reorder-btn" onClick={() => move(setCoaches, i, i - 1)} disabled={i === 0} title="Move up"><ChevronUp size={12} /></button>
                  <button className="reorder-btn" onClick={() => move(setCoaches, i, i + 1)} disabled={i === coaches.length - 1} title="Move down"><ChevronDown size={12} /></button>
                </div>
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setCoaches(p => p.filter((_, j) => j !== i))} title="Remove"><Trash2 size={12} /></button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addCoach}>+ Add Coach</button>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '16px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Captains</p>
            {captains.map((c, i) => (
              <div className="person-row" key={i}>
                <div style={{ flex: 1 }}>
                  <PersonSearch value={c.personId} onChange={(id, n) => setCaptains(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x))} onRequestCreate={() => openCreateModal((id, n) => setCaptains(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x)))} />
                </div>
                <div className="reorder-btns">
                  <button className="reorder-btn" onClick={() => move(setCaptains, i, i - 1)} disabled={i === 0} title="Move up"><ChevronUp size={12} /></button>
                  <button className="reorder-btn" onClick={() => move(setCaptains, i, i + 1)} disabled={i === captains.length - 1} title="Move down"><ChevronDown size={12} /></button>
                </div>
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setCaptains(p => p.filter((_, j) => j !== i))} title="Remove"><Trash2 size={12} /></button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addCaptain}>+ Add Captain</button>
          </div>

          {/* Roster */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Gamepad2 size={16} /> Roster</h3>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Players</p>
            {roster.map((r, i) => (
              <div className="person-row" key={i}>
                <div style={{ flex: 1 }}>
                  <PersonSearch value={r.personId} onChange={(id, n) => setRoster(p => p.map((x, j) => j === i ? { ...x, personId: id, personName: n } : x))} onRequestCreate={() => openCreateModal((id, n) => setRoster(p => p.map((x, j) => j === i ? { ...x, personId: id, personName: n } : x)))} />
                </div>
                <select className="role-select" value={r.role} onChange={e => setRoster(p => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}>
                  {ROLES.map(rl => <option key={rl.value} value={rl.value}>{rl.label}</option>)}
                </select>
                <div className="reorder-btns">
                  <button className="reorder-btn" onClick={() => move(setRoster, i, i - 1)} disabled={i === 0} title="Move up"><ChevronUp size={12} /></button>
                  <button className="reorder-btn" onClick={() => move(setRoster, i, i + 1)} disabled={i === roster.length - 1} title="Move down"><ChevronDown size={12} /></button>
                </div>
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setRoster(p => p.filter((_, j) => j !== i))} title="Remove"><Trash2 size={12} /></button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addRoster}>+ Add Player</button>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '16px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Substitutes</p>
            {subs.map((s, i) => (
              <div className="person-row" key={i}>
                <div style={{ flex: 1 }}>
                  <PersonSearch value={s.personId} onChange={(id, n) => setSubs(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x))} onRequestCreate={() => openCreateModal((id, n) => setSubs(p => p.map((x, j) => j === i ? { personId: id, personName: n } : x)))} />
                </div>
                <div className="reorder-btns">
                  <button className="reorder-btn" onClick={() => move(setSubs, i, i - 1)} disabled={i === 0} title="Move up"><ChevronUp size={12} /></button>
                  <button className="reorder-btn" onClick={() => move(setSubs, i, i + 1)} disabled={i === subs.length - 1} title="Move down"><ChevronDown size={12} /></button>
                </div>
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setSubs(p => p.filter((_, j) => j !== i))} title="Remove"><Trash2 size={12} /></button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addSub}>+ Add Sub</button>
          </div>

          {/* Achievements */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Trophy size={16} /> Achievements</h3>
            {achievements.map((a, i) => (
              <div className="person-row" key={i}>
                <input className="profile-input" style={{ flex: 1, fontSize: 13, padding: '6px 10px' }} value={a.achievement} onChange={e => setAchievements(p => p.map((x, j) => j === i ? { achievement: e.target.value } : x))} placeholder='e.g., "FACEIT S5 Champions"' />
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setAchievements(p => p.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addAchievement}>+ Add Achievement</button>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div style={editorStyles.rightColumn}>
          {/* Branding */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Palette size={16} /> Branding</h3>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={editorStyles.fieldLabel}>Primary (Glow)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <div className="color-swatch" style={{ background: brandingPrimary, boxShadow: `0 0 14px ${brandingPrimary}55` }}>
                    <input type="color" value={brandingPrimary} onChange={e => setBrandingPrimary(e.target.value)} />
                  </div>
                  <input className="profile-input" style={{ fontSize: 12, padding: '4px 8px', fontFamily: 'monospace' }} value={brandingPrimary} onChange={e => setBrandingPrimary(e.target.value)} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={editorStyles.fieldLabel}>Secondary (Fill)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <div className="color-swatch" style={{ background: brandingSecondary, boxShadow: `0 0 14px ${brandingSecondary}55` }}>
                    <input type="color" value={brandingSecondary} onChange={e => setBrandingSecondary(e.target.value)} />
                  </div>
                  <input className="profile-input" style={{ fontSize: 12, padding: '4px 8px', fontFamily: 'monospace' }} value={brandingSecondary} onChange={e => setBrandingSecondary(e.target.value)} />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div style={{ padding: 12, borderRadius: 8, background: `linear-gradient(135deg, ${brandingPrimary}15, ${brandingSecondary}15)`, border: `1px solid ${brandingPrimary}30`, textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Preview</span>
              <div style={{ fontSize: 16, fontWeight: 700, background: `linear-gradient(135deg, ${brandingPrimary}, ${brandingSecondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginTop: 4 }}>{name || 'Team Name'}</div>
            </div>
          </div>

          {/* FaceIt Integration */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><ExternalLink size={16} /> FaceIt Integration</h3>
            <div style={{ ...editorStyles.readonlyField, justifyContent: 'space-between' }}>
              <span style={editorStyles.fieldLabel}>FaceIt Enabled</span>
              <button className={`toggle-switch ${faceitEnabled ? 'on' : 'off'}`} onClick={() => setFaceitEnabled(!faceitEnabled)} type="button" />
            </div>
            {faceitEnabled && (
              <>
                <div style={editorStyles.editableField}>
                  <label style={editorStyles.fieldLabel}>Paste FaceIt Team URL</label>
                  <input
                    className="profile-input"
                    placeholder="https://www.faceit.com/en/teams/..."
                    style={{ fontSize: 12 }}
                    onChange={e => {
                      const val = e.target.value.trim()
                      // Extract UUID from FaceIt team URL
                      const uuidMatch = val.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
                      if (uuidMatch) {
                        setFaceitTeamId(uuidMatch[1])
                        e.target.value = ''
                      }
                    }}
                  />
                  <p style={{ ...editorStyles.fieldHint, margin: '4px 0 0' }}>Paste the full FaceIt team page URL and the ID will be extracted automatically.</p>
                </div>
                <div style={editorStyles.editableField}>
                  <label style={editorStyles.fieldLabel}>Team ID</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="profile-input" value={faceitTeamId} onChange={e => setFaceitTeamId(e.target.value)} placeholder="bc03efbc-725a-42f2-..." style={{ fontFamily: 'monospace', fontSize: 12, flex: 1 }} />
                    {faceitTeamId && (
                      <a href={`https://www.faceit.com/en/teams/${faceitTeamId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', flexShrink: 0 }}>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ ...editorStyles.readonlyField, justifyContent: 'space-between' }}>
                  <span style={editorStyles.fieldLabel}>Show Competitive Section</span>
                  <button className={`toggle-switch ${faceitShowCompetitive ? 'on' : 'off'}`} onClick={() => setFaceitShowCompetitive(!faceitShowCompetitive)} type="button" />
                </div>
              </>
            )}
          </div>

          {/* Scheduling */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Calendar size={16} /> Scheduling</h3>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Role Preset</label>
              <select className="profile-input" value={rolePreset} onChange={e => setRolePreset(e.target.value)} style={{ fontSize: 13 }}>
                <option value="specific">Specific (Tank, Hitscan, Flex DPS, MS, FS)</option>
                <option value="generic">Generic (Tank, DPS, Support)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {rolePreset === 'custom' && (
              <div style={editorStyles.editableField}>
                <label style={editorStyles.fieldLabel}>Custom Roles</label>
                <input className="profile-input" value={customRoles} onChange={e => setCustomRoles(e.target.value)} placeholder="Tank, DPS, Support" />
              </div>
            )}
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Timezone</label>
              <select className="profile-input" value={scheduleTimezone} onChange={e => setScheduleTimezone(e.target.value)} style={{ fontSize: 13 }}>
                <option value="">Select timezone...</option>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label} ({tz.value})</option>)}
              </select>
            </div>
          </div>

          {/* Discord Threads */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Hash size={16} /> Discord Threads</h3>
            {[
              { key: 'availabilityThreadId', label: 'Availability Thread' },
              { key: 'calendarThreadId', label: 'Calendar Thread' },
              { key: 'scheduleThreadId', label: 'Schedule Thread' },
              { key: 'scrimCodesThreadId', label: 'Scrim Codes Thread' },
            ].map(({ key, label }) => (
              <div className="thread-field" key={key}>
                <label style={editorStyles.fieldLabel}>{label}</label>
                <input className="profile-input" style={{ fontFamily: 'monospace', fontSize: 12 }} value={discordThreads[key] ?? ''} onChange={e => setDiscordThreads(p => ({ ...p, [key]: e.target.value }))} placeholder="Discord thread ID..." />
              </div>
            ))}
          </div>

          {/* Schedule Blocks */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Clock size={16} /> Time Blocks</h3>
            <p style={editorStyles.fieldHint}>Time slots shown on availability calendars. The label is what players see, start/end are 24-hour times (e.g., 18:00 = 6 PM).</p>
            {scheduleBlocks.length > 0 && (
              <div className="block-row" style={{ padding: '0 0 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Display Label</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start (24h)</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End (24h)</span>
                <span></span>
              </div>
            )}
            {scheduleBlocks.map((b, i) => (
              <div className="block-row" key={i}>
                <input className="profile-input" style={{ fontSize: 12, padding: '4px 8px' }} value={b.label} onChange={e => setScheduleBlocks(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="6-8 PM" />
                <input className="profile-input" style={{ fontSize: 12, padding: '4px 8px' }} value={b.startTime} onChange={e => setScheduleBlocks(p => p.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))} placeholder="18:00" />
                <input className="profile-input" style={{ fontSize: 12, padding: '4px 8px' }} value={b.endTime} onChange={e => setScheduleBlocks(p => p.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))} placeholder="20:00" />
                <button className="remove-btn" style={{ width: 24, height: 24 }} onClick={() => setScheduleBlocks(p => p.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="add-link-btn" style={{ marginTop: 4, fontSize: 12 }} onClick={addBlock}>+ Add Block</button>
          </div>

          {/* Quick Links */}
          {teamId && (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><ExternalLink size={16} /> Quick Links</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <a href={`/teams/${slug}`} target="_blank" rel="noopener noreferrer" style={editorStyles.quickLink}>
                  <Eye size={14} /> View on Site
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
