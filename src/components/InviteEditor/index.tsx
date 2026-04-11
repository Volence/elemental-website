'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Save, Check, AlertCircle, Loader2, ArrowLeft, Plus, Trash2,
  Link as LinkIcon, Copy, Shield, Users, Clock, Mail, User,
  ChevronRight, Search, CheckCircle, XCircle,
} from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'

// ── Types ──

type InviteLink = {
  id: number
  token: string
  role: string
  assignedTeams?: any[]
  departments?: Record<string, boolean>
  linkedPerson?: any
  email?: string
  expiresAt: string
  usedAt?: string
  usedBy?: any
  createdBy?: any
  createdAt?: string
}

type Team = { id: number; name: string }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const ROLES = [
  { value: 'admin', label: 'Admin', icon: '👑', color: '#f59e0b', desc: 'Full system access' },
  { value: 'staff-manager', label: 'Staff Manager', icon: '⚙️', color: '#34d399', desc: 'Manage staff & teams' },
  { value: 'team-manager', label: 'Team Manager', icon: '🎯', color: '#8b5cf6', desc: 'Manage assigned teams' },
  { value: 'player', label: 'Player', icon: '🎮', color: '#3b82f6', desc: 'Team roster member' },
  { value: 'user', label: 'User', icon: '👤', color: '#6b7280', desc: 'Basic department access' },
]

const DEPARTMENTS = [
  { key: 'isProductionStaff', label: 'Production', icon: '🎬' },
  { key: 'isSocialMediaStaff', label: 'Social Media', icon: '📱' },
  { key: 'isGraphicsStaff', label: 'Graphics', icon: '🎨' },
  { key: 'isVideoStaff', label: 'Video', icon: '🎥' },
  { key: 'isEventsStaff', label: 'Events', icon: '🎉' },
  { key: 'isScoutingStaff', label: 'Scouting', icon: '🔍' },
  { key: 'isContentCreator', label: 'Content Creator', icon: '📺' },
]

const getRoleConfig = (r: string) => ROLES.find(x => x.value === r) ?? ROLES[4]

const getInviteStatus = (invite: InviteLink) => {
  if (invite.usedAt) return { label: 'Used', color: '#6b7280', icon: CheckCircle }
  if (new Date(invite.expiresAt) < new Date()) return { label: 'Expired', color: '#ef4444', icon: XCircle }
  return { label: 'Active', color: '#34d399', icon: CheckCircle }
}

// ── Invite List ──

export function InviteListView() {
  const [invites, setInvites] = useState<InviteLink[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all')

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/invite-links?limit=200&sort=-createdAt&depth=1')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setInvites(data.docs ?? [])
    } catch (err) {
      console.error('Invites load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvites() }, [fetchInvites])

  // Highlight sidebar nav for Invite Links
  useEffect(() => {
    const links = document.querySelectorAll('aside nav a')
    links.forEach(link => {
      const href = link.getAttribute('href') ?? ''
      if (href.includes('/collections/invite-links')) {
        link.closest('[class*="nav-"]')?.classList.add('active')
        ;(link as HTMLElement).style.opacity = '1'
        ;(link as HTMLElement).style.color = '#34d399'
      }
    })
  }, [])

  const filtered = invites.filter(inv => {
    const status = getInviteStatus(inv)
    if (statusFilter === 'active' && status.label !== 'Active') return false
    if (statusFilter === 'used' && status.label !== 'Used') return false
    if (statusFilter === 'expired' && status.label !== 'Expired') return false
    if (search) {
      const s = search.toLowerCase()
      return inv.token?.toLowerCase().includes(s) ||
        inv.email?.toLowerCase().includes(s) ||
        inv.role?.toLowerCase().includes(s)
    }
    return true
  })

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  const activeCount = invites.filter(i => getInviteStatus(i).label === 'Active').length
  const usedCount = invites.filter(i => getInviteStatus(i).label === 'Used').length
  const expiredCount = invites.filter(i => getInviteStatus(i).label === 'Expired').length

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .inv-row { display: flex; align-items: center; gap: 10px; padding: 7px 12px; cursor: pointer; transition: background 0.1s; text-decoration: none; color: inherit; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .inv-row:hover { background: rgba(255,255,255,0.03); }
        .inv-row:first-child { border-top: 1px solid rgba(255,255,255,0.04); }
        .inv-status { display: inline-flex; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; flex-shrink: 0; }
        .inv-token { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; color: rgba(255,255,255,0.3); }
        .inv-date { font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap; }
        .filter-pill { background: none; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.1s; }
        .filter-pill:hover { background: rgba(255,255,255,0.04); }
        .filter-pill.active { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Invite Links
          <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>({invites.length})</span>
        </h1>
        <a href="/admin/edit-invite" className="profile-save-btn" style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}>
          <Plus size={13} /> New Invite
        </a>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All ({invites.length})</button>
        <button className={`filter-pill ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>Active ({activeCount})</button>
        <button className={`filter-pill ${statusFilter === 'used' ? 'active' : ''}`} onClick={() => setStatusFilter('used')}>Used ({usedCount})</button>
        <button className={`filter-pill ${statusFilter === 'expired' ? 'active' : ''}`} onClick={() => setStatusFilter('expired')}>Expired ({expiredCount})</button>
      </div>

      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
        <input className="profile-input" style={{ paddingLeft: 32, fontSize: 13, padding: '6px 10px 6px 32px' }} placeholder="Search by token, email, or role..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        <span style={{ width: 80 }}>Role</span>
        <span style={{ flex: 1 }}>Token</span>
        <span style={{ width: 160 }}>Email</span>
        <span style={{ width: 50, textAlign: 'center' }}>Status</span>
        <span style={{ width: 120, textAlign: 'right' }}>Date</span>
      </div>

      {loading ? (
        <div style={editorStyles.emptyState}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div>
          {filtered.map(inv => {
            const role = getRoleConfig(inv.role)
            const status = getInviteStatus(inv)
            return (
              <a key={inv.id} href={`/admin/edit-invite?id=${inv.id}`} className="inv-row">
                <span style={{ width: 80, fontWeight: 500, color: role.color, fontSize: 12 }}>{role.label}</span>
                <span className="inv-token" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.token.slice(0, 12)}…</span>
                <span style={{ width: 160, fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email || '—'}</span>
                <span style={{ width: 50, textAlign: 'center' }}>
                  <span className="inv-status" style={{ background: `${status.color}15`, color: status.color }}>{status.label}</span>
                </span>
                <span className="inv-date" style={{ width: 120, textAlign: 'right' }}>
                  {status.label === 'Used' ? formatDate(inv.usedAt!) : formatDate(inv.expiresAt)}
                </span>
              </a>
            )
          })}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No invite links found.</div>}
        </div>
      )}
    </div>
  )
}

// ── Invite Editor ──

export function InviteEditorView() {
  const searchParams = useSearchParams()
  const inviteId = searchParams.get('id')
  const isNew = !inviteId

  const [loading, setLoading] = useState(!isNew)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [copied, setCopied] = useState(false)

  const [token, setToken] = useState('')
  const [role, setRole] = useState('player')
  const [assignedTeams, setAssignedTeams] = useState<number[]>([])
  const [departments, setDepartments] = useState<Record<string, boolean>>({})
  const [email, setEmail] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [usedAt, setUsedAt] = useState('')
  const [usedByName, setUsedByName] = useState('')
  const [createdByName, setCreatedByName] = useState('')

  // Set default expiry for new invites
  useEffect(() => {
    if (isNew && !expiresAt) {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setExpiresAt(d.toISOString().slice(0, 16))
    }
  }, [isNew, expiresAt])

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams?limit=100&depth=0')
      if (res.ok) {
        const data = await res.json()
        setTeams((data.docs ?? []).sort((a: Team, b: Team) => a.name.localeCompare(b.name)))
      }
    } catch {}
  }, [])

  const fetchInvite = useCallback(async () => {
    if (!inviteId) return
    try {
      const res = await fetch(`/api/invite-links/${inviteId}?depth=1`)
      if (res.ok) {
        const inv = await res.json()
        setToken(inv.token ?? '')
        setRole(inv.role ?? 'player')
        setAssignedTeams((inv.assignedTeams ?? []).map((t: any) => typeof t === 'object' ? t.id : t))
        setDepartments(inv.departments ?? {})
        setEmail(inv.email ?? '')
        setExpiresAt(inv.expiresAt ? inv.expiresAt.slice(0, 16) : '')
        setUsedAt(inv.usedAt ?? '')
        setUsedByName(typeof inv.usedBy === 'object' ? (inv.usedBy?.name || inv.usedBy?.email) : '')
        setCreatedByName(typeof inv.createdBy === 'object' ? (inv.createdBy?.name || inv.createdBy?.email) : '')
      }
    } catch (err) {
      console.error('Invite load error:', err)
    } finally {
      setLoading(false)
    }
  }, [inviteId])

  useEffect(() => { fetchTeams(); fetchInvite() }, [fetchTeams, fetchInvite])

  const showTeams = ['team-manager', 'staff-manager', 'player'].includes(role)

  const handleSave = async () => {
    setSaveStatus('saving')
    setErrorMsg('')
    try {
      const payload: Record<string, any> = {
        role,
        email: email || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        departments,
      }
      if (showTeams) payload.assignedTeams = assignedTeams

      const url = inviteId ? `/api/invite-links/${inviteId}` : '/api/invite-links'
      const method = inviteId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }

      setSaveStatus('saved')
      if (isNew) {
        const doc = await res.json()
        const newId = doc.doc?.id ?? doc.id
        setTimeout(() => { window.location.href = `/admin/edit-invite?id=${newId}` }, 500)
      } else {
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!inviteId || !confirm('Delete this invite link?')) return
    try {
      await fetch(`/api/invite-links/${inviteId}`, { method: 'DELETE' })
      window.location.href = '/admin/collections/invite-links'
    } catch {}
  }

  const copyLink = () => {
    const link = `${window.location.origin}/register?invite=${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const toggleTeam = (id: number) => {
    setAssignedTeams(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const toggleDept = (key: string) => {
    setDepartments(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const roleConf = getRoleConfig(role)
  const status = inviteId ? getInviteStatus({ expiresAt, usedAt } as any) : null
  const isUsed = Boolean(usedAt)

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
        .role-option { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
        .role-option:hover { background: rgba(255,255,255,0.03); }
        .role-option.selected { border-color: currentColor; background: rgba(255,255,255,0.02); }
        .role-option.disabled { opacity: 0.35; cursor: not-allowed; }
        .dept-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
        .dept-chip:hover { background: rgba(255,255,255,0.06); }
        .dept-chip.on { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
        .team-chip { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
        .team-chip:hover { background: rgba(255,255,255,0.06); }
        .team-chip.selected { background: rgba(139, 92, 246, 0.08); border-color: rgba(139, 92, 246, 0.3); color: #a78bfa; }
      `}</style>

      <a href="/admin/collections/invite-links" className="back-link"><ArrowLeft size={14} /> Back to Invites</a>

      {/* Header */}
      <div style={editorStyles.header}>
        <div style={editorStyles.headerLeft}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: `${roleConf.color}15`, border: `2px solid ${roleConf.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {roleConf.icon}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              {isNew ? 'New Invite Link' : `${roleConf.label} Invite`}
            </h1>
            {token && <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{token}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && <span style={{ fontSize: 12, fontWeight: 500, color: status.color, padding: '4px 10px', borderRadius: 12, background: `${status.color}15` }}>{status.label}</span>}
          {inviteId && <button className="remove-btn" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={handleDelete}><Trash2 size={14} /></button>}
          {!isUsed && (
            <button className="profile-save-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                : saveStatus === 'saved' ? <><Check size={16} /> Saved!</>
                : saveStatus === 'error' ? <><AlertCircle size={16} /> Error</>
                : <><Save size={16} /> {isNew ? 'Create Invite' : 'Save Changes'}</>}
            </button>
          )}
        </div>
      </div>
      {saveStatus === 'error' && errorMsg && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{errorMsg}</p>}

      {/* Copy Link Bar */}
      {token && !isNew && (
        <div className="profile-card" style={{ ...editorStyles.card, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <LinkIcon size={16} style={{ color: '#34d399', flexShrink: 0 }} />
            <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 13, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {window.location.origin}/register?invite={token}
            </span>
          </div>
          <button className="profile-save-btn" style={{ padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={copyLink}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
          </button>
        </div>
      )}

      <div style={editorStyles.grid}>
        <div style={editorStyles.leftColumn}>
          {/* Role Selector */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Shield size={16} /> Role</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ROLES.map(r => (
                <div
                  key={r.value}
                  className={`role-option ${role === r.value ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`}
                  style={{ color: r.color }}
                  onClick={() => !isUsed && setRole(r.value)}
                >
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div>
                    <span style={{ fontWeight: role === r.value ? 600 : 400 }}>{r.label}</span>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '1px 0 0' }}>{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Access */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Users size={16} /> Department Access</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DEPARTMENTS.map(d => (
                <button
                  key={d.key}
                  className={`dept-chip ${departments[d.key] ? 'on' : ''}`}
                  onClick={() => !isUsed && toggleDept(d.key)}
                  disabled={isUsed}
                >
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={editorStyles.rightColumn}>
          {/* Email */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Mail size={16} /> Pre-assigned Email</h3>
            <input
              className="profile-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional: email@example.com"
              readOnly={isUsed}
            />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>User must sign up with this email address</p>
          </div>

          {/* Expiry */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Clock size={16} /> Expiration</h3>
            <input
              className="profile-input"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              readOnly={isUsed}
            />
          </div>

          {/* Assigned Teams */}
          {showTeams && (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><Users size={16} /> Assigned Teams</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {teams.map(t => (
                  <button
                    key={t.id}
                    className={`team-chip ${assignedTeams.includes(t.id) ? 'selected' : ''}`}
                    onClick={() => !isUsed && toggleTeam(t.id)}
                    disabled={isUsed}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Used Info */}
          {isUsed && (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><CheckCircle size={16} /> Used</h3>
              {usedByName && (
                <div style={editorStyles.editableField}>
                  <label style={editorStyles.fieldLabel}>Used By</label>
                  <p style={{ fontSize: 14, color: '#e2e8f0', margin: 0 }}>{usedByName}</p>
                </div>
              )}
              <div style={editorStyles.editableField}>
                <label style={editorStyles.fieldLabel}>Used At</label>
                <p style={{ fontSize: 14, color: '#e2e8f0', margin: 0 }}>{new Date(usedAt).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Created By */}
          {createdByName && (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><User size={16} /> Created By</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{createdByName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
