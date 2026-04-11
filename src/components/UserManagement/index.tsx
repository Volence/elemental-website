'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Users, Search, Shield, ShieldCheck, Crown, Gamepad2, User as UserIcon,
  Save, Check, AlertCircle, Loader2, ArrowLeft, Plus, Link2, Trash2,
  Monitor, ChevronRight,
} from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'

// ── Types ──

type UserData = {
  id: number
  name: string
  email: string
  role: string
  discordId?: string | null
  linkedPerson?: { id: number; name: string } | number | null
  assignedTeams?: Array<{ id: number; name: string } | number> | null
  departments?: {
    isProductionStaff?: boolean
    isSocialMediaStaff?: boolean
    isGraphicsStaff?: boolean
    isVideoStaff?: boolean
    isEventsStaff?: boolean
    isScoutingStaff?: boolean
    isContentCreator?: boolean
  } | null
  avatar?: { url: string } | number | null
  createdAt?: string
  updatedAt?: string
}

type TeamOption = { id: number; name: string }
type PersonOption = { id: number; name: string }

const ROLES = [
  { value: 'admin', label: 'Admin', icon: Crown, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
  { value: 'staff-manager', label: 'Staff Manager', icon: ShieldCheck, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)' },
  { value: 'team-manager', label: 'Team Manager', icon: Shield, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)' },
  { value: 'player', label: 'Player', icon: Gamepad2, color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.25)' },
  { value: 'user', label: 'User', icon: UserIcon, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)' },
]

const DEPARTMENTS = [
  { key: 'isProductionStaff', label: 'Production' },
  { key: 'isSocialMediaStaff', label: 'Social Media' },
  { key: 'isGraphicsStaff', label: 'Graphics' },
  { key: 'isVideoStaff', label: 'Video Editing' },
  { key: 'isEventsStaff', label: 'Events' },
  { key: 'isScoutingStaff', label: 'Scouting' },
  { key: 'isContentCreator', label: 'Content Creator' },
] as const

const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) ?? ROLES[4]

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ── Users List View ──

export function UsersListView() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=200&sort=name&depth=1')
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data.docs ?? [])
    } catch (err) {
      console.error('Users load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s))
    }
    return true
  })

  // Group by role for stats
  const roleCounts = ROLES.map(r => ({ ...r, count: users.filter(u => u.role === r.value).length }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .user-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.15s; text-decoration: none; color: inherit; }
        .user-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
        .role-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .role-stat { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }
        .role-stat:hover { border-color: rgba(255,255,255,0.1); }
        .role-stat.active { border-color: rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.05); }
        .user-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .user-avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .filter-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 10 }} />
          Users
          <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>({users.length})</span>
        </h1>
      </div>

      {/* Role stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`role-stat ${roleFilter === 'all' ? 'active' : ''}`} onClick={() => setRoleFilter('all')}>
          All ({users.length})
        </button>
        {roleCounts.map(r => (
          <button
            key={r.value}
            className={`role-stat ${roleFilter === r.value ? 'active' : ''}`}
            onClick={() => setRoleFilter(roleFilter === r.value ? 'all' : r.value)}
            style={{ color: r.color }}
          >
            <r.icon size={14} /> {r.label} ({r.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
          <input
            className="profile-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={editorStyles.emptyState}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const roleConf = getRoleConfig(u.role)
            const linkedName = u.linkedPerson && typeof u.linkedPerson === 'object' ? u.linkedPerson.name : null
            const avatarUrl = u.avatar && typeof u.avatar === 'object' ? u.avatar.url : null
            const teamCount = (u.assignedTeams ?? []).length

            return (
              <a key={u.id} href={`/admin/edit-user?id=${u.id}`} className="user-card">
                {avatarUrl ? (
                  <img src={avatarUrl} className="user-avatar" alt="" />
                ) : (
                  <div className="user-avatar-placeholder"><UserIcon size={18} style={{ opacity: 0.3 }} /></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{u.name || 'Unnamed'}</span>
                    <span className="role-pill" style={{ background: roleConf.bg, color: roleConf.color, border: `1px solid ${roleConf.border}` }}>
                      <roleConf.icon size={11} /> {roleConf.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {u.email}
                    {linkedName && <span style={{ marginLeft: 8, color: 'rgba(99,102,241,0.7)' }}>→ {linkedName}</span>}
                    {teamCount > 0 && <span style={{ marginLeft: 8, color: 'rgba(52,211,153,0.6)' }}>{teamCount} team{teamCount !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <ChevronRight size={16} style={{ opacity: 0.2, flexShrink: 0 }} />
              </a>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ ...editorStyles.emptyState, minHeight: 150 }}>
              <p style={{ opacity: 0.4 }}>No users match your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── User Editor View ──

export function UserEditorView() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('id')

  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [allTeams, setAllTeams] = useState<TeamOption[]>([])
  const [allPeople, setAllPeople] = useState<PersonOption[]>([])

  // Editable fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [discordId, setDiscordId] = useState('')
  const [linkedPerson, setLinkedPerson] = useState<number | null>(null)
  const [assignedTeams, setAssignedTeams] = useState<number[]>([])
  const [departments, setDepartments] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async () => {
    if (!userId) return
    try {
      const [userRes, teamsRes, peopleRes] = await Promise.all([
        fetch(`/api/users/${userId}?depth=1`),
        fetch('/api/teams?limit=100&sort=name&depth=0'),
        fetch('/api/people?limit=500&sort=name&depth=0'),
      ])

      if (userRes.ok) {
        const u = await userRes.json()
        setUser(u)
        setName(u.name ?? '')
        setEmail(u.email ?? '')
        setRole(u.role ?? 'user')
        setDiscordId(u.discordId ?? '')
        setLinkedPerson(typeof u.linkedPerson === 'object' ? u.linkedPerson?.id : u.linkedPerson ?? null)
        setAssignedTeams((u.assignedTeams ?? []).map((t: any) => typeof t === 'object' ? t.id : t))
        setDepartments({
          isProductionStaff: u.departments?.isProductionStaff ?? false,
          isSocialMediaStaff: u.departments?.isSocialMediaStaff ?? false,
          isGraphicsStaff: u.departments?.isGraphicsStaff ?? false,
          isVideoStaff: u.departments?.isVideoStaff ?? false,
          isEventsStaff: u.departments?.isEventsStaff ?? false,
          isScoutingStaff: u.departments?.isScoutingStaff ?? false,
          isContentCreator: u.departments?.isContentCreator ?? false,
        })
      }
      if (teamsRes.ok) {
        const t = await teamsRes.json()
        setAllTeams((t.docs ?? []).map((doc: any) => ({ id: doc.id, name: doc.name })))
      }
      if (peopleRes.ok) {
        const p = await peopleRes.json()
        setAllPeople((p.docs ?? []).map((doc: any) => ({ id: doc.id, name: doc.name })))
      }
    } catch (err) {
      console.error('User load error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!userId) return
    setSaveStatus('saving')
    setErrorMsg('')
    try {
      const payload: Record<string, any> = {
        name,
        email,
        role,
        discordId: discordId || null,
        linkedPerson: linkedPerson || null,
        assignedTeams: assignedTeams.length > 0 ? assignedTeams : null,
        departments,
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    }
  }

  const toggleTeam = (teamId: number) => {
    setAssignedTeams(prev => prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId])
  }

  const toggleDept = (key: string) => {
    setDepartments(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
        <style>{EDITOR_CSS}</style>
        <div style={editorStyles.emptyState}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, opacity: 0.6 }}>Loading user...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
        <style>{EDITOR_CSS}</style>
        <div style={editorStyles.emptyState}>
          <AlertCircle size={48} style={{ opacity: 0.3, color: '#f87171' }} />
          <h2 style={{ margin: '16px 0 8px' }}>User Not Found</h2>
        </div>
      </div>
    )
  }

  const roleConf = getRoleConfig(role)
  const showDepts = role !== 'admin' && role !== 'player'
  const linkedPersonName = allPeople.find(p => p.id === linkedPerson)?.name

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .role-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
        .role-option:hover { background: rgba(255,255,255,0.03); }
        .role-option.selected { border-color: currentColor; background: rgba(255,255,255,0.02); }
        .team-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
        .team-chip:hover { background: rgba(255,255,255,0.06); }
        .team-chip.selected { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
        .dept-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .person-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; width: 100%; outline: none; font-family: inherit; appearance: none; cursor: pointer; }
        .person-select option { background: #1e293b; color: #e2e8f0; }
      `}</style>

      <a href="/admin/collections/users" className="back-link"><ArrowLeft size={14} /> Back to Users</a>

      {/* Header */}
      <div style={editorStyles.header}>
        <div style={editorStyles.headerLeft}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: roleConf.bg, border: `2px solid ${roleConf.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <roleConf.icon size={24} color={roleConf.color} />
          </div>
          <div>
            <input className="profile-input" style={{ ...editorStyles.nameInput, fontSize: 22 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="User name" />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{email}</p>
          </div>
        </div>
        <div style={editorStyles.headerRight}>
          <button className="profile-save-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : saveStatus === 'saved' ? <><Check size={16} /> Saved!</>
              : saveStatus === 'error' ? <><AlertCircle size={16} /> Error</>
              : <><Save size={16} /> Save Changes</>}
          </button>
          {saveStatus === 'error' && errorMsg && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errorMsg}</p>}
        </div>
      </div>

      <div style={editorStyles.grid}>
        {/* Left */}
        <div style={editorStyles.leftColumn}>
          {/* Role */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Shield size={16} /> Role</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ROLES.map(r => (
                <div
                  key={r.value}
                  className={`role-option ${role === r.value ? 'selected' : ''}`}
                  style={{ color: r.color }}
                  onClick={() => setRole(r.value)}
                >
                  <r.icon size={18} />
                  <span style={{ fontWeight: role === r.value ? 600 : 400 }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Teams */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Gamepad2 size={16} /> Assigned Teams</h3>
            <p style={editorStyles.fieldHint}>Click to toggle. Determines scrim data access for players/managers.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {allTeams.map(t => (
                <button
                  key={t.id}
                  className={`team-chip ${assignedTeams.includes(t.id) ? 'selected' : ''}`}
                  onClick={() => toggleTeam(t.id)}
                >
                  {assignedTeams.includes(t.id) && <Check size={12} />}
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={editorStyles.rightColumn}>
          {/* Account Info */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><UserIcon size={16} /> Account</h3>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Email</label>
              <input className="profile-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Discord ID</label>
              <input className="profile-input" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="17-19 digit Discord User ID" />
            </div>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Linked Person</label>
              <select className="person-select" value={linkedPerson ?? ''} onChange={(e) => setLinkedPerson(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— None —</option>
                {allPeople.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {linkedPersonName && (
                <a href={`/admin/edit-person?id=${linkedPerson}`} style={{ fontSize: 12, color: '#818cf8', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Link2 size={11} /> Edit {linkedPersonName}'s profile
                </a>
              )}
            </div>
          </div>

          {/* Departments */}
          {showDepts && (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><Monitor size={16} /> Department Access</h3>
              {DEPARTMENTS.map(d => (
                <div className="dept-toggle" key={d.key}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{d.label}</span>
                  <button
                    className={`toggle-switch ${departments[d.key] ? 'on' : 'off'}`}
                    onClick={() => toggleDept(d.key)}
                    type="button"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
