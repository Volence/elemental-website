'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { fetchAllDocs } from '@/admin-kit'
import { useAuth } from '@payloadcms/ui'
import {
  Users, Search, Shield, ShieldCheck, Crown, Gamepad2, User as UserIcon,
  Loader2, ChevronRight, ShieldAlert,
} from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'
import DiscordMemberPicker from '@/components/DiscordMemberPicker'
import { canPickMembers } from '@/identity/permissions'

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
    isPugAdmin?: boolean
    canUploadExternalScrims?: boolean
  } | null
  avatar?: { url: string } | number | null
  createdAt?: string
  updatedAt?: string
}

const ROLES = [
  { value: 'admin', label: 'Admin', icon: Crown, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
  { value: 'staff-manager', label: 'Staff Manager', icon: ShieldCheck, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)' },
  { value: 'team-manager', label: 'Team Manager', icon: Shield, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)' },
  { value: 'player', label: 'Player', icon: Gamepad2, color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.25)' },
  { value: 'user', label: 'User', icon: UserIcon, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)' },
]

const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) ?? ROLES[4]

// ── Users List View ──
// The per-user editor that used to live here was folded into PersonEditor
// (/admin/edit-person), which edits the same people row with more cards.

export function UsersListView() {
  const { user: currentUser } = useAuth() as { user: any }
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const fetchUsers = useCallback(async () => {
    try {
      // Every person, paged: a single limit=200 request used to hide everyone past the first 200 by name.
      setUsers(await fetchAllDocs<UserData>('/api/people?sort=name&depth=1'))
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
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--elmt-text-disabled)', marginLeft: 8 }}>({users.length})</span>
        </h1>
        {canPickMembers(currentUser) && (
          <div style={{ marginLeft: 'auto', minWidth: 320 }}>
            <DiscordMemberPicker value={null} onChange={(id) => { if (id) window.location.href = `/admin/edit-person?id=${id}` }} placeholder="New person: search Discord..." />
          </div>
        )}
        <a
          href="/admin/access-review"
          className="add-link-btn"
          style={{ width: 'auto', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ShieldAlert size={14} />
          Access Review
        </a>
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
            const linkedName = null
            const avatarUrl = u.avatar && typeof u.avatar === 'object' ? u.avatar.url : null
            const teamCount = (u.assignedTeams ?? []).length

            return (
              <a key={u.id} href={`/admin/edit-person?id=${u.id}`} className="user-card">
                {avatarUrl ? (
                  <img loading="lazy" decoding="async" src={avatarUrl} className="user-avatar" alt="" />
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
                  <div style={{ fontSize: 12, color: 'var(--elmt-text-disabled)', marginTop: 2 }}>
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
