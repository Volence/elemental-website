'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Users, Search, Shield, UserIcon, Save, Check, AlertCircle, Loader2,
  ArrowLeft, ChevronRight, Plus, Trash2, Star, Mic, Eye, Film, Briefcase,
} from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'

// ── Types ──

type StaffEntry = {
  id: number
  displayName: string
  slug?: string
  collection: 'organization-staff' | 'production'
  roles?: string[]
  type?: string
  person?: { id: number; name: string; photo?: { url: string } | null } | number | null
}

type PersonOption = { id: number; name: string }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ── Role configs ──

const ORG_ROLES = [
  { value: 'owner', label: 'Owner', color: '#f59e0b' },
  { value: 'co-owner', label: 'Co-Owner', color: '#f59e0b' },
  { value: 'hr', label: 'HR', color: '#ec4899' },
  { value: 'moderator', label: 'Moderator', color: '#8b5cf6' },
  { value: 'event-manager', label: 'Event Manager', color: '#06b6d4' },
  { value: 'social-manager', label: 'Social Manager', color: '#3b82f6' },
  { value: 'graphics', label: 'Graphics', color: '#f97316' },
  { value: 'media-editor', label: 'Media Editor', color: '#ef4444' },
]

const PROD_TYPES = [
  { value: 'caster', label: 'Caster', color: '#34d399' },
  { value: 'observer', label: 'Observer', color: '#06b6d4' },
  { value: 'producer', label: 'Producer', color: '#8b5cf6' },
  { value: 'observer-producer', label: 'Observer/Producer', color: '#3b82f6' },
  { value: 'observer-producer-caster', label: 'Obs/Prod/Caster', color: '#f59e0b' },
]

const getRoleBadge = (entry: StaffEntry) => {
  if (entry.collection === 'organization-staff' && entry.roles) {
    return entry.roles.map(r => {
      const conf = ORG_ROLES.find(o => o.value === r)
      return { label: conf?.label ?? r, color: conf?.color ?? '#94a3b8' }
    })
  }
  if (entry.collection === 'production' && entry.type) {
    const conf = PROD_TYPES.find(p => p.value === entry.type)
    return [{ label: conf?.label ?? entry.type, color: conf?.color ?? '#94a3b8' }]
  }
  return []
}

// ── Staff Directory (List View) ──

export function StaffDirectoryView() {
  const [orgStaff, setOrgStaff] = useState<StaffEntry[]>([])
  const [prodStaff, setProdStaff] = useState<StaffEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'org' | 'production'>('all')

  const fetchStaff = useCallback(async () => {
    try {
      const [orgRes, prodRes] = await Promise.all([
        fetch('/api/organization-staff?limit=200&sort=displayName&depth=1'),
        fetch('/api/production?limit=200&sort=displayName&depth=1'),
      ])
      if (orgRes.ok) {
        const d = await orgRes.json()
        setOrgStaff((d.docs ?? []).map((doc: any) => ({ ...doc, collection: 'organization-staff' })))
      }
      if (prodRes.ok) {
        const d = await prodRes.json()
        setProdStaff((d.docs ?? []).map((doc: any) => ({ ...doc, collection: 'production' })))
      }
    } catch (err) {
      console.error('Staff load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const allStaff = [...orgStaff, ...prodStaff].sort((a, b) =>
    (a.displayName ?? '').localeCompare(b.displayName ?? '')
  )

  const filtered = (tab === 'org' ? orgStaff : tab === 'production' ? prodStaff : allStaff).filter(s => {
    if (!search) return true
    return s.displayName?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .staff-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.15s; text-decoration: none; color: inherit; }
        .staff-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
        .staff-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .staff-avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .role-badge { display: inline-flex; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
        .tab-btn { background: none; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
        .tab-btn:hover { background: rgba(255,255,255,0.04); }
        .tab-btn.active { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
        .type-label { font-size: 11px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 10 }} />
          Staff Directory
          <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>({allStaff.length})</span>
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href="/admin/edit-staff?type=org" className="profile-save-btn" style={{ fontSize: 13, padding: '8px 16px' }}>
            <Plus size={14} /> Add Staff
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All ({allStaff.length})</button>
        <button className={`tab-btn ${tab === 'org' ? 'active' : ''}`} onClick={() => setTab('org')}>
          <Briefcase size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Organization ({orgStaff.length})
        </button>
        <button className={`tab-btn ${tab === 'production' ? 'active' : ''}`} onClick={() => setTab('production')}>
          <Mic size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Production ({prodStaff.length})
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
        <input className="profile-input" style={{ paddingLeft: 36 }} placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={editorStyles.emptyState}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(s => {
            const badges = getRoleBadge(s)
            const avatarUrl = s.person && typeof s.person === 'object' && s.person.photo && typeof s.person.photo === 'object' ? s.person.photo.url : null
            const editUrl = s.collection === 'organization-staff'
              ? `/admin/edit-staff?type=org&id=${s.id}`
              : `/admin/edit-staff?type=production&id=${s.id}`

            return (
              <a key={`${s.collection}-${s.id}`} href={editUrl} className="staff-card">
                {avatarUrl ? (
                  <img src={avatarUrl} className="staff-avatar" alt="" />
                ) : (
                  <div className="staff-avatar-placeholder"><UserIcon size={18} style={{ opacity: 0.3 }} /></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{s.displayName}</span>
                    <span className="type-label">{s.collection === 'organization-staff' ? 'ORG' : 'PROD'}</span>
                    {badges.map((b, i) => (
                      <span key={i} className="role-badge" style={{ background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}40` }}>{b.label}</span>
                    ))}
                  </div>
                </div>
                <ChevronRight size={16} style={{ opacity: 0.2, flexShrink: 0 }} />
              </a>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ ...editorStyles.emptyState, minHeight: 150 }}><p style={{ opacity: 0.4 }}>No staff found.</p></div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Staff Editor ──

export function StaffEditorView() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('id')
  const staffType = searchParams.get('type') ?? 'org' // 'org' or 'production'
  const isNew = !staffId

  const collection = staffType === 'production' ? 'production' : 'organization-staff'

  const [loading, setLoading] = useState(!isNew)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [personId, setPersonId] = useState<number | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [prodType, setProdType] = useState<string>('caster')
  const [allPeople, setAllPeople] = useState<PersonOption[]>([])
  const [existingName, setExistingName] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [peopleRes] = await Promise.all([
        fetch('/api/people?limit=500&sort=name&depth=0'),
      ])
      if (peopleRes.ok) {
        const p = await peopleRes.json()
        setAllPeople((p.docs ?? []).map((d: any) => ({ id: d.id, name: d.name })))
      }

      if (staffId) {
        const res = await fetch(`/api/${collection}/${staffId}?depth=1`)
        if (res.ok) {
          const doc = await res.json()
          setPersonId(typeof doc.person === 'object' ? doc.person?.id : doc.person)
          setRoles(doc.roles ?? [])
          setProdType(doc.type ?? 'caster')
          setExistingName(doc.displayName ?? '')
        }
      }
    } catch (err) {
      console.error('Staff load error:', err)
    } finally {
      setLoading(false)
    }
  }, [staffId, collection])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!personId) {
      setErrorMsg('Please select a person')
      setSaveStatus('error')
      return
    }
    setSaveStatus('saving')
    setErrorMsg('')

    try {
      const payload: Record<string, any> = { person: personId }
      if (collection === 'organization-staff') {
        payload.roles = roles.length > 0 ? roles : ['moderator']
      } else {
        payload.type = prodType
      }

      const url = staffId ? `/api/${collection}/${staffId}` : `/api/${collection}`
      const method = staffId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }

      setSaveStatus('saved')
      if (isNew) {
        const doc = await res.json()
        const newId = doc.doc?.id ?? doc.id
        setTimeout(() => {
          window.location.href = `/admin/edit-staff?type=${staffType}&id=${newId}`
        }, 500)
      } else {
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!staffId || !confirm('Delete this staff entry?')) return
    try {
      await fetch(`/api/${collection}/${staffId}`, { method: 'DELETE' })
      window.location.href = '/admin/collections/organization-staff'
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const toggleRole = (roleVal: string) => {
    setRoles(prev => prev.includes(roleVal) ? prev.filter(r => r !== roleVal) : [...prev, roleVal])
  }

  const selectedPersonName = allPeople.find(p => p.id === personId)?.name ?? existingName

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
        <style>{EDITOR_CSS}</style>
        <div style={editorStyles.emptyState}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /></div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .role-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
        .role-chip:hover { background: rgba(255,255,255,0.06); }
        .role-chip.selected { border-width: 2px; }
        .type-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
        .type-option:hover { background: rgba(255,255,255,0.03); }
        .type-option.selected { border-color: currentColor; background: rgba(255,255,255,0.02); }
        .person-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; width: 100%; outline: none; font-family: inherit; appearance: none; cursor: pointer; }
        .person-select option { background: #1e293b; color: #e2e8f0; }
      `}</style>

      <a href="/admin/collections/organization-staff" className="back-link"><ArrowLeft size={14} /> Back to Staff Directory</a>

      {/* Header */}
      <div style={editorStyles.header}>
        <div style={editorStyles.headerLeft}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: collection === 'production' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(139, 92, 246, 0.1)', border: `2px solid ${collection === 'production' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {collection === 'production' ? <Mic size={24} color="#34d399" /> : <Briefcase size={24} color="#8b5cf6" />}
          </div>
          <div>
            <h1 style={{ ...editorStyles.name, fontSize: 22 }}>
              {isNew ? `New ${collection === 'production' ? 'Production' : 'Organization'} Staff` : selectedPersonName}
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {collection === 'production' ? 'Production Staff' : 'Organization Staff'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {staffId && (
            <button className="remove-btn" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={handleDelete}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button className="profile-save-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : saveStatus === 'saved' ? <><Check size={16} /> Saved!</>
              : saveStatus === 'error' ? <><AlertCircle size={16} /> Error</>
              : <><Save size={16} /> {isNew ? 'Create' : 'Save Changes'}</>}
          </button>
        </div>
      </div>
      {saveStatus === 'error' && errorMsg && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{errorMsg}</p>}

      <div style={editorStyles.grid}>
        <div style={editorStyles.leftColumn}>
          {/* Person */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><UserIcon size={16} /> Person</h3>
            <select className="person-select" value={personId ?? ''} onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select a person —</option>
              {allPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {personId && (
              <a href={`/admin/edit-person?id=${personId}`} style={{ fontSize: 12, color: '#818cf8', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Eye size={11} /> Edit person profile
              </a>
            )}
          </div>

          {/* Roles/Type */}
          {collection === 'organization-staff' ? (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><Star size={16} /> Roles</h3>
              <p style={editorStyles.fieldHint}>Select all roles this staff member holds.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {ORG_ROLES.map(r => (
                  <button
                    key={r.value}
                    className={`role-chip ${roles.includes(r.value) ? 'selected' : ''}`}
                    style={{ color: r.color, borderColor: roles.includes(r.value) ? r.color : undefined, background: roles.includes(r.value) ? `${r.color}15` : undefined }}
                    onClick={() => toggleRole(r.value)}
                  >
                    {roles.includes(r.value) && <Check size={12} />}
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><Mic size={16} /> Production Type</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PROD_TYPES.map(t => (
                  <div
                    key={t.value}
                    className={`type-option ${prodType === t.value ? 'selected' : ''}`}
                    style={{ color: t.color }}
                    onClick={() => setProdType(t.value)}
                  >
                    <span style={{ fontWeight: prodType === t.value ? 600 : 400 }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={editorStyles.rightColumn}>
          {/* Quick Links */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Shield size={16} /> Info</h3>
            <p style={editorStyles.fieldHint}>
              {collection === 'organization-staff'
                ? 'Organization staff handle administrative and creative roles across Elemental.'
                : 'Production staff work on match broadcasts — casting, observing, and producing.'}
            </p>
            {personId && (
              <div style={{ marginTop: 12 }}>
                <a href={`/players/${allPeople.find(p => p.id === personId)?.name?.toLowerCase().replace(/\s+/g, '-')}`} target="_blank" rel="noopener noreferrer" style={editorStyles.quickLink}>
                  <Eye size={14} /> View Public Profile
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
