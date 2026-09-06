'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Users, Search, UserIcon, Loader2, ChevronRight, Briefcase, Mic, Building2 } from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'
import { TITLE_COLORS } from '@/access/titles'
import { groupPeopleByTitle, type TitledPerson } from '@/utilities/staffFromTitles'

// ── Staff Directory (List View) ──

type Tab = 'all' | 'organization' | 'department' | 'production'

export function StaffDirectoryView() {
  const [people, setPeople] = useState<TitledPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/people?where[titles.title][exists]=true&where[isInactive][not_equals]=true&limit=0&depth=1&sort=name')
      if (res.ok) {
        const d = await res.json()
        setPeople(d.docs ?? [])
      }
    } catch (err) {
      console.error('Staff load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const groups = groupPeopleByTitle(people)
  const filteredGroups = groups.filter((g) => tab === 'all' || g.group === tab)

  const searchLower = search.toLowerCase()
  const rows = filteredGroups.flatMap((g) =>
    g.members
      .filter((m) => !searchLower || m.person.name.toLowerCase().includes(searchLower))
      .map((m) => ({ ...m, groupTitle: g.title, groupLabel: g.label })),
  )

  const countFor = (group: Tab) => groups.filter((g) => group === 'all' || g.group === group)
    .reduce((sum, g) => sum + g.members.length, 0)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .staff-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.15s; text-decoration: none; color: inherit; }
        .staff-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
        .staff-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .staff-avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .role-badge { display: inline-flex; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
        .lead-badge { display: inline-flex; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
        .tab-btn { background: none; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
        .tab-btn:hover { background: rgba(255,255,255,0.04); }
        .tab-btn.active { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 10 }} />
          Staff Directory
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--elmt-text-disabled)', marginLeft: 8 }}>({countFor('all')})</span>
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All ({countFor('all')})</button>
        <button className={`tab-btn ${tab === 'organization' ? 'active' : ''}`} onClick={() => setTab('organization')}>
          <Building2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Organization ({countFor('organization')})
        </button>
        <button className={`tab-btn ${tab === 'department' ? 'active' : ''}`} onClick={() => setTab('department')}>
          <Briefcase size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Departments ({countFor('department')})
        </button>
        <button className={`tab-btn ${tab === 'production' ? 'active' : ''}`} onClick={() => setTab('production')}>
          <Mic size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Production ({countFor('production')})
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
          {rows.map((row) => {
            const person = row.person as any
            const avatarUrl = person.photo && typeof person.photo === 'object' ? person.photo.url : null
            const color = TITLE_COLORS[row.groupTitle] ?? '#94a3b8'

            return (
              <a key={`${row.groupTitle}-${person.id}`} href={`/admin/edit-person?id=${person.id}`} className="staff-card">
                {avatarUrl ? (
                  <img loading="lazy" decoding="async" src={avatarUrl} className="staff-avatar" alt="" />
                ) : (
                  <div className="staff-avatar-placeholder"><UserIcon size={18} style={{ opacity: 0.3 }} /></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{person.name}</span>
                    <span className="role-badge" style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>{row.groupLabel}</span>
                    {row.isLead && <span className="lead-badge">Lead</span>}
                    {row.regions.length > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{row.regions.map((r) => r.toUpperCase()).join(', ')}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} style={{ opacity: 0.2, flexShrink: 0 }} />
              </a>
            )
          })}
          {rows.length === 0 && (
            <div style={{ ...editorStyles.emptyState, minHeight: 150 }}><p style={{ opacity: 0.4 }}>No staff found.</p></div>
          )}
        </div>
      )}
    </div>
  )
}
