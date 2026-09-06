'use client'
import React, { useState } from 'react'
import { Gamepad2, X } from 'lucide-react'
import type { ResolvedAccess } from '@/access/resolve'

export interface TeamOption { id: number; name: string }

interface Props {
  value: number[]
  onChange: (v: number[]) => void
  allTeams: TeamOption[]
  actor: ResolvedAccess | null
}

/**
 * Teams offered for a search query: not already selected, name contains the query
 * (case-insensitive), names starting with the query first, then alphabetical, capped.
 * An empty query offers nothing - the list is long and the point of the picker is to
 * avoid rendering all of it.
 */
export function matchTeams(allTeams: TeamOption[], query: string, selected: number[], limit = 8): TeamOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const chosen = new Set(selected)
  return allTeams
    .filter((t) => !chosen.has(t.id) && t.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
      return aStarts - bStarts || a.name.localeCompare(b.name)
    })
    .slice(0, limit)
}

export default function TeamAccessSection({ value, onChange, allTeams, actor }: Props) {
  const editable = actor?.canManagePeople === true
  const [query, setQuery] = useState('')
  const byId = new Map(allTeams.map((t) => [t.id, t]))
  const selected = value.map((id) => byId.get(id) ?? { id, name: `Team ${id}` })
  const matches = matchTeams(allTeams, query, value)

  const add = (id: number) => {
    if (!value.includes(id)) onChange([...value, id])
    setQuery('')
  }
  const remove = (id: number) => onChange(value.filter((t) => t !== id))

  return (
    <div className="profile-card" data-testid="team-access-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gamepad2 size={16} /> Access-only teams</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Grants manager rights on the team. Not shown on the site. Team membership is set on the team page.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {selected.length === 0 && <span style={{ fontSize: 13, opacity: 0.4 }}>No access-only teams.</span>}
        {selected.map((t) => (
          <span key={t.id} className="team-chip selected" data-testid={`team-access-chip-${t.id}`}>
            {t.name}
            {editable && (
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => remove(t.id)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>

      {editable && (
        <div style={{ position: 'relative', marginTop: 10 }}>
          <input
            className="profile-input"
            data-testid="team-access-search"
            aria-label="Add team"
            placeholder="Add team..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) { e.preventDefault(); add(matches[0].id) }
              if (e.key === 'Escape') setQuery('')
            }}
          />
          {query.trim() && (
            <div role="listbox" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, maxHeight: 280, overflowY: 'auto', zIndex: 50 }}>
              {matches.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: 13, opacity: 0.5 }}>No teams match.</div>
              ) : matches.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => add(t.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
